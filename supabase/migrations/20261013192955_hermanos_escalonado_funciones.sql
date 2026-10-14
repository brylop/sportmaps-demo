-- =============================================================================
-- 20261013192955_hermanos_escalonado_funciones.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-14   Versión anterior: 20261013192946
-- Objetivo: F2 de docs/specs/dreamers-cierre-total.md — el descuento por
--   hermanos pasa a ser ESCALONADO (school_settings.sibling_discount_tiers) y
--   reconoce hermanos sin cuenta de acudiente (school_sibling_links). Requiere
--   20261013192946 (helpers _sibling_rank / _sibling_tier_pct / _sibling_link_core).
--
--   CREATE OR REPLACE desde el CUERPO VIVO (no el repo), verificado por md5 sin
--   CR el 2026-10-13 en la viva y en el gemelo:
--     open_month                       8473ddd7a859392dacff8fb63950718e
--     preview_open_month               625b4538785389e862c9324f2a7b2dc3
--     _descuentos_automaticos_calc     7430c56b3978564d75f595074f83fc3e
--     _plan_charge_operation           4939354886d36ffbdeeed32a67816cfe
--     create_enrollment_with_payments  6ffe0338924cad6f95f6e7aaf1bed04b
--   Cambios (marcados con «F2 hermanos escalonado (20261013192955)»):
--     · open_month / preview_open_month: pct = _sibling_tier_pct(_sibling_rank)
--       para menores sin fee_is_manual; sin requisito de c.parent_id. preview
--       además excluye las mismas categorías que open_month (antes divergían).
--     · _descuentos_automaticos_calc: la etiqueta «hermanos» lleva el %
--       implícito del escalón aplicado.
--     · _plan_charge_operation: solo el bloque «Hermanos (Q17)».
--     · create_enrollment_with_payments: sibling_of_child_id = vínculo 'alta';
--       candado por escuela; valida sibling_discount_applied (±1) o
--       'hermanos_desactualizado'; lo guarda en el cobro.
-- Compatible con el SQL Editor (sin TEMP TABLE).
-- =============================================================================

BEGIN;

-- ── Guarda: cuerpos vivos = los leídos (md5 sin CR) ─────────────────────────
-- Si ya traen la marca de esta migración, se re-aplica sin error.
DO $$
DECLARE
  v_md5  text;
  v_done boolean;
BEGIN
  SELECT md5(replace(prosrc, E'\r', '')), prosrc LIKE '%F2 hermanos escalonado (20261013192955)%'
    INTO v_md5, v_done FROM pg_proc WHERE oid = 'public.open_month(uuid,integer,integer,uuid)'::regprocedure;
  IF v_md5 IS DISTINCT FROM '8473ddd7a859392dacff8fb63950718e' AND NOT COALESCE(v_done, false) THEN
    RAISE EXCEPTION 'F2 hermanos: el cuerpo vivo de public.open_month cambió (md5 %); regenerar esta migración desde la viva', v_md5;
  END IF;
  SELECT md5(replace(prosrc, E'\r', '')), prosrc LIKE '%F2 hermanos escalonado (20261013192955)%'
    INTO v_md5, v_done FROM pg_proc WHERE oid = 'public.preview_open_month(uuid,integer,integer,uuid)'::regprocedure;
  IF v_md5 IS DISTINCT FROM '625b4538785389e862c9324f2a7b2dc3' AND NOT COALESCE(v_done, false) THEN
    RAISE EXCEPTION 'F2 hermanos: el cuerpo vivo de public.preview_open_month cambió (md5 %); regenerar esta migración desde la viva', v_md5;
  END IF;
  SELECT md5(replace(prosrc, E'\r', '')), prosrc LIKE '%F2 hermanos escalonado (20261013192955)%'
    INTO v_md5, v_done FROM pg_proc WHERE oid = 'public._descuentos_automaticos_calc(public.payments)'::regprocedure;
  IF v_md5 IS DISTINCT FROM '7430c56b3978564d75f595074f83fc3e' AND NOT COALESCE(v_done, false) THEN
    RAISE EXCEPTION 'F2 hermanos: el cuerpo vivo de public._descuentos_automaticos_calc cambió (md5 %); regenerar esta migración desde la viva', v_md5;
  END IF;
  SELECT md5(replace(prosrc, E'\r', '')), prosrc LIKE '%F2 hermanos escalonado (20261013192955)%'
    INTO v_md5, v_done FROM pg_proc WHERE oid = 'public._plan_charge_operation(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)'::regprocedure;
  IF v_md5 IS DISTINCT FROM '4939354886d36ffbdeeed32a67816cfe' AND NOT COALESCE(v_done, false) THEN
    RAISE EXCEPTION 'F2 hermanos: el cuerpo vivo de public._plan_charge_operation cambió (md5 %); regenerar esta migración desde la viva', v_md5;
  END IF;
  SELECT md5(replace(prosrc, E'\r', '')), prosrc LIKE '%F2 hermanos escalonado (20261013192955)%'
    INTO v_md5, v_done FROM pg_proc WHERE oid = 'public.create_enrollment_with_payments(uuid,jsonb,jsonb)'::regprocedure;
  IF v_md5 IS DISTINCT FROM '6ffe0338924cad6f95f6e7aaf1bed04b' AND NOT COALESCE(v_done, false) THEN
    RAISE EXCEPTION 'F2 hermanos: el cuerpo vivo de public.create_enrollment_with_payments cambió (md5 %); regenerar esta migración desde la viva', v_md5;
  END IF;
END $$;

-- ── open_month ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_created          int := 0;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
  v_grace            int;
  v_today            date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado para abrir el mes de esta escuela.';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_school_id::text || ':' || p_year::text || ':' || p_month::text, 0)
  );

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(payment_grace_days, 5),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_grace, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_grace  := COALESCE(v_grace, 5);

  v_due := make_date(
    p_year, p_month,
    LEAST(v_cutoff, extract(day from (v_month_end - 1))::int)
  );
  -- FIX 2026-10-05 (H-01): un cobro NUEVO nunca nace vencido. Si el corte del
  -- mes ya pasó (el cron abre el mes en curso todos los días, y una escuela que
  -- pone precio el 8 con corte el 1 recibía cobros vencidos esa misma noche), el
  -- vencimiento pasa a hoy + días de gracia: la MISMA regla que billingDue
  -- (bff/src/services/enrollmentBilling.ts) y qr_first_charge_due_date. El
  -- PERIODO no cambia: sigue siendo p_year/p_month.
  IF v_due < v_today THEN
    v_due := v_today + v_grace;
  END IF;

  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      e.school_id,
      COALESCE(c.branch_id, t.branch_id)                             AS branch_id,
      c.parent_id,
      e.child_id,
      e.user_id,
      e.unregistered_athlete_id,
      e.team_id,
      e.offering_plan_id,
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta')    AS athlete_name,
      fee.amount                                                     AS amount,
      fee.sibling_discount_applied                                   AS sibling_discount_applied
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
               NULLIF(e.monthly_fee, 0),
               NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
               NULLIF(t.price_monthly, 0),
               NULLIF(c.monthly_fee, 0),
               0
             ) AS base_amount
    ) base
    CROSS JOIN LATERAL (
      -- F2 hermanos escalonado (20261013192955): % del escalón según el
      -- rango del niño en su familia ACTIVA (mismo parent_id o vínculo de
      -- school_sibling_links; ya no exige c.parent_id). Un niño con varias
      -- inscripciones cuenta una vez; fee_is_manual no recibe pero cuenta.
      SELECT CASE
               WHEN v_sibling_enabled AND e.child_id IS NOT NULL AND NOT e.fee_is_manual
               THEN public._sibling_tier_pct(e.school_id, public._sibling_rank(e.school_id, e.child_id))
               ELSE 0
             END AS pct
    ) sib
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
             ELSE ROUND(base.base_amount * (1 - sib.pct / 100.0))
        END AS amount,
        CASE WHEN NOT e.fee_is_manual AND sib.pct > 0
             THEN ROUND(base.base_amount * sib.pct / 100.0)
        END AS sibling_discount_applied
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
          AND (
            r.resumed_at IS NULL
            OR date_trunc('month', (r.resumed_at AT TIME ZONE 'America/Bogota')::date)::date
                 >= v_month_start
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          -- 20261005221734: inscripción / seguro / excedente no son la
          -- mensualidad del período aunque traigan period_year/period_month.
          -- 20261007095911: tampoco artículos, torneo, clase extra, vacacional
          -- ni viaje (cobros sueltos de servicio, ventas por WhatsApp).
          AND COALESCE(p2.payment_category, '') NOT IN (
                'inscripcion', 'seguro', 'excedente',
                'articulos', 'torneo', 'clase_extra', 'vacacional', 'viaje')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL
                   AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  ),
  ins AS (
    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, concept, amount, due_date, status, payment_type,
      period_year, period_month, payment_category, sibling_discount_applied
    )
    SELECT
      el.school_id, el.branch_id, el.parent_id, el.child_id, el.user_id,
      el.unregistered_athlete_id, el.team_id, el.offering_plan_id,
      'Mensualidad ' || to_char(v_due, 'MM/YYYY') || ' - ' || el.athlete_name,
      el.amount, v_due, 'pending', 'subscription',
      p_year::smallint, p_month::smallint, 'mensualidad', el.sibling_discount_applied
    FROM elegibles el
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_created FROM ins;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date',  v_due, 'generados', v_created
  );
END;
$function$;

-- ── preview_open_month ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_open_month(p_school_id uuid, p_year integer, p_month integer, p_branch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_month_start      date := make_date(p_year, p_month, 1);
  v_month_end        date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
  v_cutoff           int;
  v_due              date;
  v_items            jsonb;
  v_caller           uuid := auth.uid();
  v_sibling_enabled  boolean;
  v_sibling_pct      numeric;
  v_grace            int;
  v_today            date := (now() AT TIME ZONE 'America/Bogota')::date;
BEGIN
  IF v_caller IS NOT NULL
     AND NOT (public.is_super_admin() OR public.is_school_admin(p_school_id)) THEN
    RAISE EXCEPTION 'No autorizado.';
  END IF;

  SELECT COALESCE(payment_cutoff_day, 10),
         COALESCE(payment_grace_days, 5),
         COALESCE(sibling_discount_enabled, false),
         COALESCE(sibling_discount_percentage, 0)
  INTO v_cutoff, v_grace, v_sibling_enabled, v_sibling_pct
  FROM public.school_settings WHERE school_id = p_school_id;
  v_cutoff := COALESCE(v_cutoff, 10);
  v_grace  := COALESCE(v_grace, 5);
  v_due := make_date(p_year, p_month, LEAST(v_cutoff, extract(day from (v_month_end - 1))::int));
  -- Mismo piso que open_month (FIX 2026-10-05, H-01): lo que se previsualiza es
  -- lo que se emite.
  IF v_due < v_today THEN
    v_due := v_today + v_grace;
  END IF;

  WITH elegibles AS (
    SELECT DISTINCT ON (COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id))
      COALESCE(c.full_name, pr.full_name, ua.full_name, 'Atleta') AS athlete_name,
      CASE WHEN e.child_id IS NOT NULL THEN 'menor'
           WHEN e.user_id  IS NOT NULL THEN 'adulto'
           ELSE 'no_registrado' END                                AS tipo,
      fee.amount                                                   AS amount,
      fee.sibling_discount_applied                                 AS sibling_discount_applied
    FROM public.enrollments e
    LEFT JOIN public.children               c  ON c.id  = e.child_id
    LEFT JOIN public.profiles               pr ON pr.id = e.user_id
    LEFT JOIN public.unregistered_athletes  ua ON ua.id = e.unregistered_athlete_id
    LEFT JOIN public.teams                  t  ON t.id  = e.team_id
    CROSS JOIN LATERAL (
      SELECT COALESCE(
               NULLIF(e.monthly_fee, 0),
               NULLIF((SELECT op.price FROM public.offering_plans op WHERE op.id = e.offering_plan_id), 0),
               NULLIF(t.price_monthly, 0),
               NULLIF(c.monthly_fee, 0),
               0
             ) AS base_amount
    ) base
    CROSS JOIN LATERAL (
      -- F2 hermanos escalonado (20261013192955): % del escalón según el
      -- rango del niño en su familia ACTIVA (mismo parent_id o vínculo de
      -- school_sibling_links; ya no exige c.parent_id). Un niño con varias
      -- inscripciones cuenta una vez; fee_is_manual no recibe pero cuenta.
      SELECT CASE
               WHEN v_sibling_enabled AND e.child_id IS NOT NULL AND NOT e.fee_is_manual
               THEN public._sibling_tier_pct(e.school_id, public._sibling_rank(e.school_id, e.child_id))
               ELSE 0
             END AS pct
    ) sib
    CROSS JOIN LATERAL (
      SELECT
        CASE WHEN e.fee_is_manual THEN COALESCE(e.monthly_fee, 0)
             ELSE ROUND(base.base_amount * (1 - sib.pct / 100.0))
        END AS amount,
        CASE WHEN NOT e.fee_is_manual AND sib.pct > 0
             THEN ROUND(base.base_amount * sib.pct / 100.0)
        END AS sibling_discount_applied
    ) fee
    WHERE e.school_id = p_school_id
      AND e.status = 'active'
      AND COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id) IS NOT NULL
      AND fee.amount > 0
      AND (p_branch_id IS NULL OR COALESCE(c.branch_id, t.branch_id) = p_branch_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.enrollment_pause_requests r
        WHERE r.enrollment_id = e.id
          AND r.status = 'approved'
          AND v_month_start BETWEEN r.month_from AND r.month_to
          AND (
            r.resumed_at IS NULL
            OR date_trunc('month', (r.resumed_at AT TIME ZONE 'America/Bogota')::date)::date
                 >= v_month_start
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.payments p2
        WHERE p2.school_id = e.school_id
          AND p2.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
          -- 20261005221734: inscripción / seguro / excedente no son la
          -- mensualidad del período aunque traigan period_year/period_month.
          -- F2 hermanos escalonado (20261013192955): misma lista que open_month
          -- (20261007095911) para que lo previsualizado sea lo que se emite.
          AND COALESCE(p2.payment_category, '') NOT IN (
                'inscripcion', 'seguro', 'excedente',
                'articulos', 'torneo', 'clase_extra', 'vacacional', 'viaje')
          AND (
                (e.child_id IS NOT NULL AND p2.child_id = e.child_id)
             OR (e.child_id IS NULL AND e.user_id IS NOT NULL
                   AND (p2.user_id = e.user_id OR p2.parent_id = e.user_id))
             OR (e.unregistered_athlete_id IS NOT NULL
                   AND p2.unregistered_athlete_id = e.unregistered_athlete_id)
          )
          AND (
                (p2.period_year = p_year AND p2.period_month = p_month)
             OR (p2.period_year IS NULL AND p2.due_date >= v_month_start AND p2.due_date < v_month_end)
          )
      )
    ORDER BY COALESCE(e.child_id, e.user_id, e.unregistered_athlete_id),
             (e.offering_plan_id IS NOT NULL) DESC,
             (e.team_id IS NOT NULL)          DESC,
             e.created_at ASC
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'athlete',  el.athlete_name,
           'tipo',     el.tipo,
           'amount',   el.amount,
           'sibling_discount_applied', el.sibling_discount_applied,
           'due_date', v_due
         )), '[]'::jsonb)
  INTO v_items
  FROM elegibles el;

  RETURN jsonb_build_object(
    'school_id', p_school_id, 'year', p_year, 'month', p_month,
    'due_date', v_due,
    'count', jsonb_array_length(v_items),
    'items', v_items
  );
END;
$function$;

-- ── _descuentos_automaticos_calc ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._descuentos_automaticos_calc(p payments)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    v_is_mens   boolean := COALESCE(p.payment_category, 'mensualidad') = 'mensualidad';
    v_late      numeric := COALESCE(p.late_fee_amount, 0);
    v_net       numeric := p.amount - COALESCE(p.late_fee_amount, 0);  -- valor sin recargo
    v_sib       numeric := GREATEST(COALESCE(p.sibling_discount_applied, 0), 0);
    v_mil       numeric := 0;
    v_mil_pct   numeric;
    v_alta      numeric := 0;
    v_list      numeric;
    v_disc      numeric;
    v_fee       numeric;
    v_lprice    numeric;
    v_sib_pct   numeric;
    v_items     jsonb := '[]'::jsonb;
    v_es_alta   boolean := p.discount_pct IS NOT NULL AND p.list_amount IS NOT NULL;
BEGIN
    IF p.amount IS NULL THEN
        RETURN NULL;
    END IF;

    -- Militar (solo mensualidad con plan y fuera del alta).
    IF v_is_mens AND p.offering_plan_id IS NOT NULL AND NOT v_es_alta
       AND EXISTS (SELECT 1 FROM public.enrollments e0
                    WHERE e0.school_id = p.school_id
                      AND e0.fee_discount_origin IS NOT NULL) THEN
        SELECT e.monthly_fee,
               e.fee_discount_pct,
               COALESCE(NULLIF(op.price, 0), NULLIF(t.price_monthly, 0))
          INTO v_fee, v_mil_pct, v_lprice
          FROM public.enrollments e
          LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
          LEFT JOIN public.teams t           ON t.id  = e.team_id
         WHERE e.school_id = p.school_id
           AND e.offering_plan_id = p.offering_plan_id
           AND e.status = 'active'
           AND e.fee_discount_origin = 'militar'
           AND (
                 (p.child_id IS NOT NULL AND e.child_id = p.child_id)
              OR (p.child_id IS NULL AND p.unregistered_athlete_id IS NOT NULL
                    AND e.unregistered_athlete_id = p.unregistered_athlete_id)
              OR (p.child_id IS NULL AND p.unregistered_athlete_id IS NULL
                    AND p.user_id IS NOT NULL AND e.user_id = p.user_id)
           )
         ORDER BY e.created_at DESC
         LIMIT 1;

        IF FOUND AND v_fee IS NOT NULL AND v_lprice IS NOT NULL AND v_lprice > v_fee
           AND abs((v_net + v_sib) - v_fee) <= 1 THEN
            v_mil := v_lprice - v_fee;
        END IF;
    END IF;

    IF v_es_alta THEN
        v_list := p.list_amount;
        IF v_list < v_net THEN
            -- Lista menor que lo cobrado: incoherente; se ignora la lista.
            v_list := v_net + v_sib;
            v_disc := v_sib;
        ELSE
            v_disc := v_list - v_net;
            v_sib  := LEAST(v_sib, v_disc);
            v_alta := v_disc - v_sib;
        END IF;
    ELSE
        IF v_sib = 0 AND v_mil = 0 THEN
            IF p.list_amount IS NULL THEN
                RETURN NULL;
            END IF;
            -- Llegó lista sin descuento conocido: se respeta si es coherente.
            v_list := GREATEST(p.list_amount, v_net);
            v_disc := v_list - v_net;
        ELSE
            v_list := v_net + v_sib + v_mil;
            v_disc := v_sib + v_mil;
        END IF;
    END IF;

    IF v_mil > 0 THEN
        v_items := v_items || jsonb_build_object(
            'origin', 'militar',
            'basis', CASE WHEN v_mil_pct IS NOT NULL THEN 'porcentaje' ELSE 'valor' END,
            'pct', v_mil_pct,
            'amount', v_mil,
            'reason_code', 'convenio',
            'reason_text', 'Descuento Fuerza Militar');
    END IF;

    IF v_sib > 0 THEN
        -- F2 hermanos escalonado (20261013192955): el % es el IMPLÍCITO del
        -- escalón que se aplicó (con escalones ya no hay un % único en
        -- school_settings). Base: lista del alta, o lo cobrado + el descuento.
        v_sib_pct := CASE
            WHEN v_es_alta AND v_list > 0 THEN round(v_sib * 100 / v_list, 2)
            WHEN NOT v_es_alta AND (v_net + v_sib) > 0 THEN round(v_sib * 100 / (v_net + v_sib), 2)
        END;
        IF v_sib_pct IS NOT NULL AND abs(v_sib_pct - round(v_sib_pct)) < 0.1 THEN
            v_sib_pct := round(v_sib_pct);
        END IF;
        v_items := v_items || jsonb_build_object(
            'origin', 'hermanos',
            'basis', CASE WHEN v_sib_pct IS NOT NULL AND v_sib_pct <= 100 THEN 'porcentaje' ELSE 'valor' END,
            'pct', CASE WHEN v_sib_pct IS NOT NULL AND v_sib_pct <= 100 THEN v_sib_pct END,
            'amount', v_sib,
            'reason_code', 'hermanos',
            'reason_text', NULL);
    END IF;

    IF v_alta > 0 THEN
        v_items := v_items || jsonb_build_object(
            'origin', 'alta_solo_este_mes',
            'basis', 'porcentaje',
            'pct', p.discount_pct,
            'amount', v_alta,
            'reason_code', 'descuento_alta',
            'reason_text', NULL);
    END IF;

    RETURN jsonb_build_object(
        'list_amount', v_list,
        'discount_amount', v_disc,
        'context', CASE WHEN p.discount_pct IS NOT NULL THEN 'alta' ELSE 'al_crear' END,
        'items', v_items);
END;
$function$;

-- ── _plan_charge_operation (solo el bloque «Hermanos (Q17)») ────────────────
CREATE OR REPLACE FUNCTION public._plan_charge_operation(p_school_id uuid, p_actor uuid, p_mode text, p_athletes jsonb, p_lines jsonb, p_overrides jsonb DEFAULT '[]'::jsonb, p_pending jsonb DEFAULT '[]'::jsonb, p_global_discount jsonb DEFAULT NULL::jsonb, p_payment jsonb DEFAULT NULL::jsonb, p_new_athlete jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
    c_cats    constant text[] := ARRAY['mensualidad','inscripcion','articulos','torneo','otro','seguro',
                                       'excedente','clase_extra','vacacional','viaje'];
    c_motivos constant text[] := ARRAY['pronto_pago','varios_meses','hermanos','beca','convenio','cortesia',
                                       'ajuste_de_precio','error_de_cobro','condonacion_mora','otro'];
    c_meses   constant text[] := ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                                       'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    c_omitibles constant text[] := ARRAY['seguro_en_12_meses','misma_linea_hoy'];
    v_today     date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_month0    date := date_trunc('month', (now() AT TIME ZONE 'America/Bogota')::date)::date;
    v_role      text;
    v_athletes  jsonb := COALESCE(p_athletes, '[]'::jsonb);
    v_lines     jsonb := COALESCE(p_lines, '[]'::jsonb);
    v_pending   jsonb := COALESCE(p_pending, '[]'::jsonb);
    v_overrides jsonb := COALESCE(p_overrides, '[]'::jsonb);
    v_n_ath     integer;
    v_n_lines   integer;
    v_n_pend    integer;
    v_ath       jsonb[] := '{}';
    v_items     jsonb[] := '{}';
    v_errors    jsonb := '[]'::jsonb;
    v_skipped   jsonb := '[]'::jsonb;
    v_a         jsonb;
    v_l         jsonb;
    v_it        jsonb;
    v_pe        jsonb;
    v_type      text;
    v_aid       uuid;
    v_key       text;
    v_is_new    boolean;
    v_child     uuid;
    v_user      uuid;
    v_unreg     uuid;
    v_name      text;
    v_parent    uuid;
    v_branch    uuid;
    v_child_fee numeric;
    v_warn      jsonb;
    v_has_active boolean;
    v_e         record;
    v_ep        record;
    v_p         public.payments;
    v_ov        record;
    v_cat       text;
    v_due       date;
    v_py        integer;
    v_pm        integer;
    v_concept   text;
    v_concept_in text;
    v_list      numeric;
    v_mil       numeric;
    v_mil_pct   numeric;
    v_sib       numeric;
    v_sib_pct   numeric;
    v_sib_on    boolean;
    v_auto      jsonb;
    v_skip_raw  text;
    v_skip      text;
    v_ovr       text;
    v_is_mens   boolean;
    v_plan_id   uuid;
    v_team_id   uuid;
    v_enr_id    uuid;
    v_ov_id     uuid;
    v_disc_obj  jsonb;
    v_exon_obj  jsonb;
    v_pay_spec  jsonb;
    v_status    text;
    v_context   text;
    v_ids_seen  text[] := '{}';
    v_i         integer;
    v_j         integer;
    v_k         integer;
    v_tmp       text;
    v_lidx      integer;
    -- descuento global
    v_g_basis   text;
    v_g_value   numeric;
    v_g_reason  text;
    v_g_text    text;
    v_g_refs    text[];
    v_g_idx     integer[] := '{}';
    v_g_w       numeric[] := '{}';
    v_g_cap     numeric[] := '{}';
    v_g_share   numeric[] := '{}';
    v_g_active  boolean[] := '{}';
    v_g_rem     numeric;
    v_g_tot       numeric;
    v_g_sum     numeric;
    v_g_left    numeric;
    v_g_frac    numeric[];
    v_g_any_sat boolean;
    v_floor     numeric;
    -- pago
    v_pay       numeric;
    v_saldo     numeric;
    v_close     text;
    v_cr_code   text;
    v_cr_text   text;
    -- totales
    v_to_create_n integer := 0;
    v_to_create_t numeric := 0;
    v_to_pay_n    integer := 0;
    v_to_pay_t    numeric := 0;
    v_disc_t      numeric := 0;
    v_waived_t    numeric := 0;
    v_exon_n      integer := 0;
    v_exon_t      numeric := 0;
    v_by_cat      jsonb := '{}'::jsonb;
    v_by_reason   jsonb := '{}'::jsonb;
    v_sin_acud    integer := 0;
    v_canon       jsonb := '[]'::jsonb;
    v_items_out   jsonb := '[]'::jsonb;
    v_pend_out    jsonb := '[]'::jsonb;
    v_ath_out     jsonb := '[]'::jsonb;
    v_existing    jsonb;
BEGIN
    -- ── 0. Actor, escuela, forma ────────────────────────────────────────────
    v_role := public._actor_rol_finanzas(p_school_id, p_actor);
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela (owner, admin o school_admin)' USING ERRCODE = '42501';
    END IF;
    IF NOT COALESCE(public.school_is_operational(p_school_id), false) THEN
        RAISE EXCEPTION 'ESCUELA_NO_OPERATIVA: la escuela no está operativa (prueba vencida)' USING ERRCODE = 'P0001';
    END IF;
    IF p_mode IS NULL OR p_mode NOT IN ('single', 'multi') THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: mode' USING ERRCODE = 'P0001';
    END IF;
    IF jsonb_typeof(v_athletes) <> 'array' OR jsonb_typeof(v_lines) <> 'array'
       OR jsonb_typeof(v_pending) <> 'array' OR jsonb_typeof(v_overrides) <> 'array' THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: athletes, lines, pending y overrides deben ser arreglos' USING ERRCODE = 'P0001';
    END IF;

    v_n_ath   := jsonb_array_length(v_athletes);
    v_n_lines := jsonb_array_length(v_lines);
    v_n_pend  := jsonb_array_length(v_pending);

    IF p_new_athlete IS NOT NULL AND p_mode <> 'single' THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: «+ Atleta nuevo» solo en modo un atleta' USING ERRCODE = 'P0001';
    END IF;
    IF p_new_athlete IS NOT NULL AND v_n_ath = 0 THEN
        -- Vista previa con atleta nuevo: atleta virtual (sin ficha todavía).
        v_n_ath := 1;
    END IF;

    -- Topes (Q10).
    IF v_n_ath > 200 THEN
        RAISE EXCEPTION 'TOPE_EXCEDIDO: máximo 200 atletas por lote' USING ERRCODE = 'P0001';
    END IF;
    IF v_n_lines > 10 THEN
        RAISE EXCEPTION 'TOPE_EXCEDIDO: máximo 10 líneas' USING ERRCODE = 'P0001';
    END IF;
    IF v_n_ath * v_n_lines > 600 THEN
        RAISE EXCEPTION 'TOPE_EXCEDIDO: máximo 600 cobros por lote' USING ERRCODE = 'P0001';
    END IF;
    IF v_n_pend > 24 THEN
        RAISE EXCEPTION 'TOPE_EXCEDIDO: máximo 24 cobros pendientes por operación' USING ERRCODE = 'P0001';
    END IF;
    IF v_n_ath < 1 THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: nunca un cobro sin atleta (D17)' USING ERRCODE = 'P0001';
    END IF;
    IF v_n_lines + v_n_pend = 0 THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: nada que hacer' USING ERRCODE = 'P0001';
    END IF;

    -- D11: el modo varios solo genera.
    IF (p_mode = 'multi' OR v_n_ath > 1) AND (v_n_pend > 0 OR p_payment IS NOT NULL) THEN
        RAISE EXCEPTION 'MULTI_NO_PAGA: en modo varios solo se generan cobros' USING ERRCODE = 'P0001';
    END IF;
    IF p_mode = 'single' AND v_n_ath <> 1 THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: modo un atleta exige exactamente un atleta' USING ERRCODE = 'P0001';
    END IF;

    IF p_payment IS NOT NULL THEN
        IF COALESCE(p_payment->>'method', '') NOT IN ('cash', 'transfer') THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: método de pago (cash | transfer)' USING ERRCODE = 'P0001';
        END IF;
        IF NULLIF(p_payment->>'payment_date', '') IS NULL
           OR (p_payment->>'payment_date')::date > v_today THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: fecha de pago vacía o futura' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- ── 1. Atletas ───────────────────────────────────────────────────────────
    FOR v_i IN 0 .. v_n_ath - 1 LOOP
        v_a := v_athletes -> v_i;
        v_warn := '[]'::jsonb;
        v_child := NULL; v_user := NULL; v_unreg := NULL; v_name := NULL;
        v_parent := NULL; v_branch := NULL; v_child_fee := NULL;

        IF v_a IS NULL THEN
            -- Atleta virtual de la vista previa (p_new_athlete sin ficha todavía).
            v_is_new := true;
            v_type := CASE WHEN p_new_athlete->>'kind' = 'adulto' THEN 'unregistered' ELSE 'child' END;
            v_aid := NULL;
            v_name := btrim(p_new_athlete->>'full_name');
            IF v_name IS NULL OR length(v_name) < 3 OR length(v_name) > 120 THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: nombre del atleta nuevo (3 a 120 caracteres)' USING ERRCODE = 'P0001';
            END IF;
            IF v_type = 'child' AND NULLIF(p_new_athlete->>'date_of_birth', '') IS NOT NULL
               AND (p_new_athlete->>'date_of_birth')::date <= (v_today - interval '18 years')::date THEN
                v_warn := v_warn || '"mayor_de_edad"'::jsonb;
            END IF;
        ELSE
            v_type := v_a->>'type';
            v_aid := NULLIF(v_a->>'id', '')::uuid;
            v_is_new := COALESCE((v_a->>'is_new')::boolean, false);
            IF v_type NOT IN ('child', 'adult', 'unregistered') OR v_aid IS NULL THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: atleta % (type child|adult|unregistered + id)', v_i USING ERRCODE = 'P0001';
            END IF;
            IF v_aid::text = ANY (v_ids_seen) THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: atleta repetido %', v_aid USING ERRCODE = 'P0001';
            END IF;
            v_ids_seen := v_ids_seen || v_aid::text;

            IF v_type = 'child' THEN
                SELECT c.full_name, c.branch_id, c.monthly_fee INTO v_name, v_branch, v_child_fee
                  FROM public.children c
                 WHERE c.id = v_aid
                   AND (c.school_id = p_school_id
                        OR EXISTS (SELECT 1 FROM public.enrollments e
                                    WHERE e.child_id = c.id AND e.school_id = p_school_id));
                v_child := v_aid;
            ELSIF v_type = 'adult' THEN
                SELECT pr.full_name INTO v_name
                  FROM public.profiles pr
                 WHERE pr.id = v_aid
                   AND (EXISTS (SELECT 1 FROM public.enrollments e
                                 WHERE e.user_id = pr.id AND e.school_id = p_school_id)
                        OR EXISTS (SELECT 1 FROM public.school_members sm
                                    WHERE sm.profile_id = pr.id AND sm.school_id = p_school_id
                                      AND sm.role = 'athlete'));
                v_user := v_aid;
            ELSE
                SELECT ua.full_name, ua.branch_id INTO v_name, v_branch
                  FROM public.unregistered_athletes ua
                 WHERE ua.id = v_aid AND ua.school_id = p_school_id;
                v_unreg := v_aid;
            END IF;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'ATLETA_AJENO: el atleta % no es de esta escuela', v_aid USING ERRCODE = 'P0001';
            END IF;
        END IF;

        v_key := CASE WHEN v_is_new THEN 'nuevo' ELSE v_aid::text END;
        v_parent := public._resolve_payment_payer(v_child, v_user, v_unreg);
        IF v_type = 'child' AND v_parent IS NULL THEN
            v_warn := v_warn || '"sin_acudiente"'::jsonb;
            v_sin_acud := v_sin_acud + 1;
        END IF;

        -- Inscripción principal (activa primero; is_primary; con plan; mayor monto).
        SELECT e.id, e.status, e.offering_plan_id, e.team_id, e.monthly_fee, e.fee_is_manual,
               e.fee_discount_origin, e.fee_discount_pct, e.created_at, e.paused_at, e.paused_until,
               op.price AS plan_price, op.name AS plan_name,
               t.price_monthly AS team_price, t.name AS team_name, t.branch_id AS team_branch
          INTO v_ep
          FROM public.enrollments e
          LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
          LEFT JOIN public.teams t           ON t.id  = e.team_id
         WHERE e.school_id = p_school_id
           AND e.status <> 'cancelled'
           AND (   (v_child IS NOT NULL AND e.child_id = v_child)
                OR (v_user  IS NOT NULL AND e.user_id  = v_user)
                OR (v_unreg IS NOT NULL AND e.unregistered_athlete_id = v_unreg))
         ORDER BY (e.status = 'active') DESC,
                  EXISTS (SELECT 1 FROM public.enrollment_categories ec
                           WHERE ec.enrollment_id = e.id AND ec.is_primary AND ec.status = 'active') DESC,
                  (e.offering_plan_id IS NOT NULL) DESC,
                  (e.team_id IS NOT NULL) DESC,
                  COALESCE(NULLIF(e.monthly_fee, 0), op.price, t.price_monthly, 0) DESC,
                  e.created_at ASC
         LIMIT 1;

        v_has_active := v_ep.id IS NOT NULL AND v_ep.status = 'active';
        IF NOT v_has_active THEN
            v_warn := v_warn || '"sin_inscripcion_activa"'::jsonb;
        END IF;
        IF v_ep.id IS NOT NULL AND v_ep.paused_at IS NOT NULL
           AND (v_ep.paused_until IS NULL OR v_ep.paused_until > now()) THEN
            v_warn := v_warn || '"pausado"'::jsonb;
        END IF;

        v_ath := v_ath || jsonb_build_object(
            'key', v_key, 'type', v_type, 'id', v_aid, 'is_new', v_is_new,
            'child_id', v_child, 'user_id', v_user, 'unregistered_athlete_id', v_unreg,
            'name', COALESCE(v_name, 'Atleta'), 'parent_id', v_parent,
            'branch_id', COALESCE(v_branch, v_ep.team_branch),
            'child_monthly_fee', v_child_fee,
            'has_active_enrollment', v_has_active,
            'enrollment_id', v_ep.id, 'team_id', v_ep.team_id,
            'warnings', v_warn);
    END LOOP;

    -- ── 2. Líneas nuevas por atleta ─────────────────────────────────────────
    FOR v_i IN 1 .. array_length(v_ath, 1) LOOP
        v_a := v_ath[v_i];
        v_child := NULLIF(v_a->>'child_id', '')::uuid;
        v_user  := NULLIF(v_a->>'user_id', '')::uuid;
        v_unreg := NULLIF(v_a->>'unregistered_athlete_id', '')::uuid;

        FOR v_j IN 0 .. v_n_lines - 1 LOOP
            v_l := v_lines -> v_j;
            -- idx lo manda el BFF (§9.2); si falta, la posición.
            v_lidx := COALESCE(NULLIF(v_l->>'idx', '')::int, v_j);
            v_cat := v_l->>'category';
            IF v_cat IS NULL OR NOT (v_cat = ANY (c_cats)) THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: categoría % (línea %)', v_cat, v_j USING ERRCODE = 'P0001';
            END IF;
            v_due := NULLIF(v_l->>'due_date', '')::date;
            IF v_due IS NULL OR v_due < v_today THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: vencimiento vacío o anterior a hoy (línea %)', v_j USING ERRCODE = 'P0001';
            END IF;
            v_concept_in := NULLIF(btrim(COALESCE(v_l->>'concept', '')), '');
            IF v_cat NOT IN ('mensualidad', 'excedente')
               AND (v_concept_in IS NULL OR length(v_concept_in) > 120) THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: concepto (1 a 120 caracteres, línea %)', v_j USING ERRCODE = 'P0001';
            END IF;
            IF length(COALESCE(v_l->>'notes', '')) > 500 THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: nota de más de 500 caracteres (línea %)', v_j USING ERRCODE = 'P0001';
            END IF;
            v_disc_obj := CASE WHEN jsonb_typeof(v_l->'discount') = 'object' THEN v_l->'discount' END;
            v_exon_obj := CASE WHEN jsonb_typeof(v_l->'exonerate') = 'object' THEN v_l->'exonerate' END;
            IF v_disc_obj IS NOT NULL AND v_exon_obj IS NOT NULL THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: descuento y «No cobrar» son excluyentes (línea %)', v_j USING ERRCODE = 'P0001';
            END IF;
            IF v_exon_obj IS NOT NULL AND p_mode = 'multi' THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: en modo varios no hay exoneración (§15.7)' USING ERRCODE = 'P0001';
            END IF;

            v_is_mens := v_cat = 'mensualidad';
            v_list := NULL; v_mil := 0; v_mil_pct := NULL; v_sib := 0; v_sib_pct := NULL;
            v_plan_id := NULL; v_team_id := (v_a->>'team_id')::uuid; v_enr_id := NULL; v_ov_id := NULL;
            v_py := NULL; v_pm := NULL; v_concept := NULL;
            v_warn := '[]'::jsonb;
            v_it := jsonb_build_object('errors', '[]'::jsonb);

            IF v_cat = 'mensualidad' THEN
                v_py := NULLIF(v_l#>>'{period,year}', '')::int;
                v_pm := NULLIF(v_l#>>'{period,month}', '')::int;
                IF v_py IS NULL OR v_pm IS NULL OR v_pm < 1 OR v_pm > 12 THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: la mensualidad exige período (línea %)', v_j USING ERRCODE = 'P0001';
                END IF;
                IF make_date(v_py, v_pm, 1) < (v_month0 - interval '12 months')::date
                   OR make_date(v_py, v_pm, 1) > (v_month0 + interval '3 months')::date THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: período fuera de [hoy − 12 meses, hoy + 3 meses] (línea %)', v_j USING ERRCODE = 'P0001';
                END IF;
                IF make_date(v_py, v_pm, 1) < v_month0 THEN
                    v_warn := v_warn || '"mes_pasado"'::jsonb;
                END IF;

                SELECT e.id, e.status, e.offering_plan_id, e.team_id, e.monthly_fee, e.fee_is_manual,
                       e.fee_discount_origin, e.fee_discount_pct, e.created_at, e.child_id,
                       op.price AS plan_price, op.name AS plan_name,
                       t.price_monthly AS team_price, t.name AS team_name, t.branch_id AS team_branch
                  INTO v_e
                  FROM public.enrollments e
                  LEFT JOIN public.offering_plans op ON op.id = e.offering_plan_id
                  LEFT JOIN public.teams t           ON t.id  = e.team_id
                 WHERE e.school_id = p_school_id
                   AND e.status <> 'cancelled'
                   AND (e.offering_plan_id IS NOT NULL OR e.team_id IS NOT NULL)
                   AND (   (v_child IS NOT NULL AND e.child_id = v_child)
                        OR (v_user  IS NOT NULL AND e.user_id  = v_user)
                        OR (v_unreg IS NOT NULL AND e.unregistered_athlete_id = v_unreg))
                   AND (p_mode <> 'single' OR NULLIF(v_l->>'enrollment_id', '') IS NULL
                        OR e.id = (v_l->>'enrollment_id')::uuid)
                 ORDER BY (e.status = 'active') DESC,
                          EXISTS (SELECT 1 FROM public.enrollment_categories ec
                                   WHERE ec.enrollment_id = e.id AND ec.is_primary AND ec.status = 'active') DESC,
                          (e.offering_plan_id IS NOT NULL) DESC,
                          COALESCE(NULLIF(e.monthly_fee, 0), op.price, t.price_monthly, 0) DESC,
                          e.created_at ASC
                 LIMIT 1;

                IF p_mode = 'single' AND NULLIF(v_l->>'enrollment_id', '') IS NOT NULL AND v_e.id IS NULL THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: la inscripción % no es de este atleta', v_l->>'enrollment_id' USING ERRCODE = 'P0001';
                END IF;

                IF v_e.id IS NOT NULL THEN
                    v_enr_id  := v_e.id;
                    v_plan_id := v_e.offering_plan_id;
                    v_team_id := v_e.team_id;
                    IF NULLIF(v_l->>'amount', '') IS NOT NULL THEN
                        v_list := (v_l->>'amount')::numeric;          -- valor de lista que escribió el personal
                    ELSE
                        -- D4: monthly_fee → precio del plan → precio del equipo (como open_month).
                        v_list := COALESCE(NULLIF(v_e.monthly_fee, 0), NULLIF(v_e.plan_price, 0),
                                           NULLIF(v_e.team_price, 0), NULLIF((v_a->>'child_monthly_fee')::numeric, 0));
                        -- Militar: la tarifa ya viene rebajada; la lista es el precio.
                        IF v_list IS NOT NULL AND v_e.fee_discount_origin = 'militar'
                           AND COALESCE(NULLIF(v_e.plan_price, 0), NULLIF(v_e.team_price, 0)) > v_list THEN
                            v_mil := COALESCE(NULLIF(v_e.plan_price, 0), NULLIF(v_e.team_price, 0)) - v_list;
                            v_mil_pct := v_e.fee_discount_pct;
                            v_list := v_list + v_mil;
                        END IF;
                    END IF;
                    -- Hermanos (Q17): sugerencia que se puede quitar con auto_discounts=false.
                    -- F2 hermanos escalonado (20261013192955): % del escalón por el
                    -- rango en la familia activa (acudiente o school_sibling_links);
                    -- ya no exige parent_id. Inscripción no activa: su propia fecha.
                    v_sib_on := COALESCE((v_l->>'auto_discounts')::boolean, true);
                    IF v_sib_on AND v_list IS NOT NULL AND NOT COALESCE(v_e.fee_is_manual, false)
                       AND v_child IS NOT NULL THEN
                        v_sib_pct := NULLIF(public._sibling_tier_pct(p_school_id,
                                         public._sibling_rank(p_school_id, v_child,
                                             CASE WHEN v_e.status = 'active' THEN NULL ELSE v_e.created_at END)), 0);
                        IF v_sib_pct IS NOT NULL THEN
                            v_sib := round((v_list - v_mil) * v_sib_pct / 100);
                        END IF;
                    END IF;
                    v_concept := 'Mensualidad ' || c_meses[v_pm] || ' ' || v_py
                                 || ' — ' || COALESCE(v_e.plan_name, v_e.team_name, 'Plan')
                                 || ' — ' || (v_a->>'name');
                    IF v_e.status <> 'active' THEN
                        v_warn := v_warn || '"sin_inscripcion_activa"'::jsonb;
                    END IF;
                ELSE
                    v_list := NULLIF(v_l->>'amount', '')::numeric;
                    v_concept := 'Mensualidad ' || c_meses[v_pm] || ' ' || v_py || ' — ' || (v_a->>'name');
                END IF;

            ELSIF v_cat = 'excedente' THEN
                -- Q6 / H4: solo el owner factura excedentes.
                IF v_role NOT IN ('owner', 'platform_admin') THEN
                    RAISE EXCEPTION 'SOLO_OWNER_EXCEDENTE: solo el dueño de la escuela factura horas de más' USING ERRCODE = 'P0001';
                END IF;
                v_ov_id := NULLIF(v_l->>'overage_charge_id', '')::uuid;
                IF v_ov_id IS NULL THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: excedente sin overage_charge_id (línea %)', v_j USING ERRCODE = 'P0001';
                END IF;
                SELECT o.id, o.amount, o.billable_hours, o.hourly_rate, hp.period_start,
                       e.child_id, e.user_id, e.unregistered_athlete_id, e.team_id, e.id AS enr_id
                  INTO v_ov
                  FROM public.hour_bank_overage_charges o
                  JOIN public.enrollments e ON e.id = o.enrollment_id
                  LEFT JOIN public.hour_bank_periods hp ON hp.id = o.period_id
                 WHERE o.id = v_ov_id AND o.school_id = p_school_id;
                IF v_ov.id IS NULL THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: excedente % no es de esta escuela', v_ov_id USING ERRCODE = 'P0001';
                END IF;
                IF NOT (   (v_child IS NOT NULL AND v_ov.child_id = v_child)
                        OR (v_user  IS NOT NULL AND v_ov.user_id  = v_user)
                        OR (v_unreg IS NOT NULL AND v_ov.unregistered_athlete_id = v_unreg)) THEN
                    RAISE EXCEPTION 'ATLETA_AJENO: el excedente % no es de este atleta', v_ov_id USING ERRCODE = 'P0001';
                END IF;
                v_list := COALESCE(NULLIF(v_l->>'amount', '')::numeric, v_ov.amount);
                v_team_id := v_ov.team_id;
                v_enr_id := v_ov.enr_id;
                v_py := extract(year FROM v_ov.period_start)::int;
                v_pm := extract(month FROM v_ov.period_start)::int;
                v_concept := format('Horas por encima del plan — %s %s — %s h × $%s',
                                    c_meses[v_pm], v_py,
                                    public.hour_bank_fmt_es(v_ov.billable_hours),
                                    public.hour_bank_fmt_es(v_ov.hourly_rate));
            ELSE
                v_list := NULLIF(v_l->>'amount', '')::numeric;
                v_py := extract(year FROM v_due)::int;
                v_pm := extract(month FROM v_due)::int;
                v_concept := v_concept_in || ' — ' || (v_a->>'name');
            END IF;

            IF v_list IS NULL OR v_list <= 0 OR v_list > 20000000 THEN
                IF v_cat = 'mensualidad' AND v_list IS NULL AND v_enr_id IS NOT NULL THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: el atleta % no tiene tarifa: escribe el monto (línea %)', v_a->>'name', v_j USING ERRCODE = 'P0001';
                ELSIF NOT (v_cat = 'mensualidad' AND v_enr_id IS NULL) THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: monto fuera de (0, 20.000.000] (línea %)', v_j USING ERRCODE = 'P0001';
                END IF;
            END IF;

            -- Duplicados (§7.1) y decisiones del personal.
            v_skip_raw := public._charge_duplicate_reason(p_school_id,
                jsonb_build_object('child_id', v_child, 'user_id', v_user, 'unregistered_athlete_id', v_unreg),
                jsonb_build_object('category', v_cat, 'period_year', v_py, 'period_month', v_pm,
                                   'amount', v_list, 'concept', v_concept, 'overage_charge_id', v_ov_id));
            IF p_mode = 'multi' AND v_skip_raw IS NULL
               AND NOT COALESCE((v_a->>'has_active_enrollment')::boolean, false) THEN
                v_skip_raw := 'sin_inscripcion_activa';                 -- Q16
            END IF;
            v_skip := v_skip_raw;

            SELECT o->>'action' INTO v_ovr
              FROM jsonb_array_elements(v_overrides) o
             WHERE (o->>'athlete' = (v_a->>'key') OR o->>'athlete' = (v_a->>'id'))
               AND (o->>'line_idx')::int = v_lidx
             LIMIT 1;
            IF v_ovr = 'skip' THEN
                v_skip := 'omitido';
            ELSIF v_ovr = 'force' AND v_skip_raw = ANY (c_omitibles) THEN
                v_skip := NULL;
                v_warn := v_warn || to_jsonb(v_skip_raw);
            END IF;

            IF v_skip IS NULL AND v_exon_obj IS NOT NULL AND NOT v_is_mens THEN
                v_skip := 'exonerado';                                   -- §6.5: no se crea
                v_exon_n := v_exon_n + 1;
                v_exon_t := v_exon_t + COALESCE(v_list, 0);
            END IF;

            v_it := jsonb_build_object(
                'ref', 'new:' || v_lidx,
                'type', 'new',
                'athlete', v_a->>'key',
                'athlete_name', v_a->>'name',
                'line_idx', v_lidx,
                'category', v_cat,
                'is_mens', v_is_mens,
                'concept', v_concept,
                'notes', NULLIF(btrim(COALESCE(v_l->>'notes', '')), ''),
                'due_date', v_due,
                'period_year', v_py,
                'period_month', v_pm,
                'period_uniqueness_exempt', NOT v_is_mens,
                'payment_type', CASE WHEN v_is_mens THEN 'subscription' ELSE 'one_time' END,
                'offering_plan_id', CASE WHEN v_is_mens THEN v_plan_id END,
                'enrollment_id', v_enr_id,
                'team_id', v_team_id,
                'branch_id', v_a->>'branch_id',
                'child_id', v_child,
                'user_id', v_user,
                'unregistered_athlete_id', v_unreg,
                'parent_id', v_a->>'parent_id',
                'overage_charge_id', v_ov_id,
                'skip_reason_raw', v_skip_raw,
                'skip_reason', v_skip,
                'will_create', v_skip IS NULL,
                'list', v_list,
                'disc', v_mil + v_sib,
                'late', 0, 'waived', 0,
                'amount', COALESCE(v_list, 0) - v_mil - v_sib,
                'amount_before', v_list,
                'paid', 0, 'epd', 0,
                'sibling_discount_applied', CASE WHEN v_sib > 0 THEN v_sib END,
                'auto_disc', v_mil + v_sib,
                'status', 'pending',
                'exonerated', v_exon_obj IS NOT NULL,
                'adjustments', '[]'::jsonb,
                'errors', '[]'::jsonb,
                'warnings', COALESCE(v_a->'warnings', '[]'::jsonb) || v_warn);

            -- Ajustes automáticos (orden §15.6): militar → hermanos.
            IF v_mil > 0 THEN
                v_it := jsonb_set(v_it, '{adjustments}', (v_it->'adjustments') || jsonb_build_object(
                    'kind', 'descuento', 'origin', 'militar',
                    'basis', CASE WHEN v_mil_pct IS NOT NULL THEN 'porcentaje' ELSE 'valor' END,
                    'pct', v_mil_pct, 'amount', v_mil, 'scope', 'linea', 'context', 'al_crear',
                    'reason_code', 'convenio', 'reason_text', 'Descuento Fuerza Militar',
                    'amount_before', v_list, 'amount_after', v_list - v_mil));
            END IF;
            IF v_sib > 0 THEN
                v_it := jsonb_set(v_it, '{adjustments}', (v_it->'adjustments') || jsonb_build_object(
                    'kind', 'descuento', 'origin', 'hermanos', 'basis', 'porcentaje',
                    'pct', v_sib_pct, 'amount', v_sib, 'scope', 'linea', 'context', 'al_crear',
                    'reason_code', 'hermanos', 'reason_text', NULL,
                    'amount_before', v_list - v_mil, 'amount_after', v_list - v_mil - v_sib));
            END IF;

            IF v_skip IS NULL THEN
                -- Descuento por línea.
                IF v_disc_obj IS NOT NULL THEN
                    IF NOT (COALESCE(v_disc_obj->>'reason_code', '') = ANY (c_motivos)) THEN
                        RAISE EXCEPTION 'DATOS_INVALIDOS: motivo de descuento (línea %)', v_j USING ERRCODE = 'P0001';
                    END IF;
                    IF v_disc_obj->>'reason_code' = 'otro'
                       AND length(btrim(COALESCE(v_disc_obj->>'reason_text', ''))) < 3 THEN
                        RAISE EXCEPTION 'MOTIVO_REQUERIDO: el motivo «otro» exige texto (línea %)', v_j USING ERRCODE = 'P0001';
                    END IF;
                    v_it := public._plan_aplicar_ajuste(v_it, 'descuento', v_disc_obj->>'basis',
                        NULLIF(v_disc_obj->>'value', '')::numeric, 'linea', 'al_crear',
                        v_disc_obj->>'reason_code', v_disc_obj->>'reason_text');
                END IF;
                -- «No cobrar» una mensualidad = beca del mes ('paid' en $0).
                IF v_exon_obj IS NOT NULL AND v_is_mens THEN
                    IF length(btrim(COALESCE(v_exon_obj->>'reason_text', ''))) < 3 THEN
                        RAISE EXCEPTION 'MOTIVO_REQUERIDO: la exoneración exige motivo (línea %)', v_j USING ERRCODE = 'P0001';
                    END IF;
                    v_it := public._plan_aplicar_ajuste(v_it, 'exoneracion', 'valor', NULL, 'linea', 'al_crear',
                        COALESCE(NULLIF(v_exon_obj->>'reason_code', ''), 'beca'), v_exon_obj->>'reason_text');
                    v_exon_n := v_exon_n + 1;
                    v_exon_t := v_exon_t + COALESCE(v_list, 0);
                END IF;
                -- Pago de la línea nueva («Ya lo pagaron»): por defecto el total.
                v_it := v_it || jsonb_build_object(
                    'pay_spec', CASE WHEN p_payment IS NULL OR v_exon_obj IS NOT NULL
                                       OR v_l->'pay' = 'false'::jsonb THEN '0'::jsonb
                                     WHEN NULLIF(v_l->>'pay_amount', '') IS NOT NULL THEN v_l->'pay_amount'
                                     ELSE '"full"'::jsonb END,
                    'close_mode', COALESCE(NULLIF(v_l->>'close_mode', ''), 'abono'),
                    'close_reason_code', v_disc_obj->>'reason_code',
                    'close_reason_text', v_disc_obj->>'reason_text');
            ELSE
                v_skipped := v_skipped || jsonb_build_object(
                    'athlete', v_a->>'key', 'athlete_name', v_a->>'name',
                    'line_idx', v_lidx, 'reason', v_skip);
            END IF;

            v_items := v_items || v_it;
        END LOOP;
    END LOOP;

    -- ── 3. Cobros pendientes marcados (solo modo un atleta) ─────────────────
    v_a := v_ath[1];
    v_child := NULLIF(v_a->>'child_id', '')::uuid;
    v_user  := NULLIF(v_a->>'user_id', '')::uuid;
    v_unreg := NULLIF(v_a->>'unregistered_athlete_id', '')::uuid;
    v_ids_seen := '{}';
    FOR v_k IN 0 .. v_n_pend - 1 LOOP
        v_pe := v_pending -> v_k;
        v_tmp := v_pe->>'payment_id';
        IF v_tmp IS NULL OR v_tmp = ANY (v_ids_seen) THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: cobro pendiente vacío o repetido' USING ERRCODE = 'P0001';
        END IF;
        v_ids_seen := v_ids_seen || v_tmp;

        SELECT * INTO v_p FROM public.payments p WHERE p.id = v_tmp::uuid AND p.school_id = p_school_id;
        IF NOT FOUND OR NOT (
               (v_child IS NOT NULL AND v_p.child_id = v_child)
            OR (v_user  IS NOT NULL AND v_p.child_id IS NULL AND v_p.user_id = v_user)
            OR (v_unreg IS NOT NULL AND v_p.unregistered_athlete_id = v_unreg)) THEN
            RAISE EXCEPTION 'ATLETA_AJENO: el cobro % no es de este atleta', v_tmp USING ERRCODE = 'P0001';
        END IF;

        v_disc_obj := CASE WHEN jsonb_typeof(v_pe->'discount') = 'object' THEN v_pe->'discount' END;
        v_exon_obj := CASE WHEN jsonb_typeof(v_pe->'exonerate') = 'object' THEN v_pe->'exonerate' END;
        v_pay := COALESCE(NULLIF(v_pe->>'pay_amount', '')::numeric, 0);
        v_close := COALESCE(NULLIF(v_pe->>'close_mode', ''), 'abono');
        IF v_exon_obj IS NOT NULL AND (v_disc_obj IS NOT NULL OR v_pay > 0) THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: «No cobrar» excluye descuento y pago (cobro %)', v_tmp USING ERRCODE = 'P0001';
        END IF;
        IF v_pay < 0 OR v_pay > 20000000 THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: monto recibido fuera de rango (cobro %)', v_tmp USING ERRCODE = 'P0001';
        END IF;
        IF v_pay > 0 AND p_payment IS NULL THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: falta el bloque de pago («Ya lo pagaron»)' USING ERRCODE = 'P0001';
        END IF;

        -- Q6 / H4: un excedente solo lo descuenta, condona o exonera el owner.
        IF v_p.payment_category = 'excedente' AND v_role NOT IN ('owner', 'platform_admin')
           AND (v_disc_obj IS NOT NULL OR v_exon_obj IS NOT NULL OR v_close = 'cerrar'
                OR jsonb_typeof(v_pe->'waive_late_fee') = 'object') THEN
            RAISE EXCEPTION 'FORBIDDEN: solo el dueño de la escuela ajusta un cobro de horas de más' USING ERRCODE = '42501';
        END IF;

        v_context := CASE WHEN p_payment IS NOT NULL AND v_pay > 0 THEN 'al_pagar' ELSE 'sobre_pendiente' END;
        v_it := jsonb_build_object(
            'ref', 'pending:' || v_p.id,
            'type', 'pending',
            'payment_id', v_p.id,
            'athlete', v_a->>'key',
            'category', COALESCE(v_p.payment_category, 'mensualidad'),
            'is_mens', COALESCE(v_p.payment_category, 'mensualidad') = 'mensualidad',
            'concept', v_p.concept,
            'due_date', v_p.due_date,
            'parent_id', v_p.parent_id,
            'user_id', v_p.user_id,
            'list', v_p.list_amount,
            'disc', v_p.discount_amount,
            'late', v_p.late_fee_amount,
            'waived', v_p.late_fee_waived_amount,
            'amount', v_p.amount,
            'amount_before', v_p.amount,
            'paid', COALESCE(v_p.amount_paid, 0),
            'paid_before', COALESCE(v_p.amount_paid, 0),
            'epd', COALESCE(v_p.early_payment_discount_applied, 0),
            'status_before', v_p.status,
            'status', v_p.status,
            'exonerated', v_exon_obj IS NOT NULL,
            'adjustments', '[]'::jsonb,
            'errors', '[]'::jsonb,
            'warnings', '[]'::jsonb);

        -- Ajustes ya registrados (para las etiquetas en orden).
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'id', a.id, 'kind', a.kind, 'origin', a.origin, 'applies_to', a.applies_to,
                   'sequence', a.sequence, 'basis', a.basis, 'pct', a.pct, 'amount', a.amount,
                   'reason_code', a.reason_code, 'scope', a.scope) ORDER BY a.sequence), '[]'::jsonb)
          INTO v_existing
          FROM public.payment_adjustments a
         WHERE a.payment_id = v_p.id AND a.kind <> 'reversion'
           AND NOT EXISTS (SELECT 1 FROM public.payment_adjustments r WHERE r.reverts_id = a.id);
        v_it := v_it || jsonb_build_object('existing_adjustments', v_existing);

        -- Estado y vista previa vieja.
        IF v_p.status = 'awaiting_approval'
           OR EXISTS (SELECT 1 FROM public.payment_installments i
                       WHERE i.payment_id = v_p.id AND i.status = 'pending_review') THEN
            v_it := jsonb_set(v_it, '{errors}', (v_it->'errors') || jsonb_build_object(
                'ref', v_it->>'ref', 'code', 'EN_REVISION'));
        ELSIF v_p.status NOT IN ('pending', 'overdue', 'partial', 'rejected', 'failed') THEN
            v_it := jsonb_set(v_it, '{errors}', (v_it->'errors') || jsonb_build_object(
                'ref', v_it->>'ref', 'code', 'COBRO_CAMBIO', 'detail', v_p.status));
        END IF;
        IF v_pe ? 'seen' AND (
               (v_pe#>>'{seen,amount}')::numeric IS DISTINCT FROM v_p.amount
            OR COALESCE((v_pe#>>'{seen,amount_paid}')::numeric, 0) <> COALESCE(v_p.amount_paid, 0)) THEN
            v_it := jsonb_set(v_it, '{errors}', (v_it->'errors') || jsonb_build_object(
                'ref', v_it->>'ref', 'code', 'PREVIEW_STALE'));
        END IF;
        IF EXISTS (SELECT 1 FROM public.payment_links l
                    WHERE l.payment_id = v_p.id AND l.status = 'pending' AND l.expires_at > now()) THEN
            IF v_disc_obj IS NOT NULL OR v_exon_obj IS NOT NULL OR v_close = 'cerrar'
               OR jsonb_typeof(v_pe->'waive_late_fee') = 'object' THEN
                v_it := jsonb_set(v_it, '{errors}', (v_it->'errors') || jsonb_build_object(
                    'ref', v_it->>'ref', 'code', 'PAGO_EN_CURSO'));
            ELSE
                v_it := jsonb_set(v_it, '{warnings}', (v_it->'warnings') || '"pago_en_curso"'::jsonb);
            END IF;
        END IF;

        IF jsonb_array_length(v_it->'errors') = 0 THEN
            -- Descuento por línea.
            IF v_disc_obj IS NOT NULL THEN
                IF NOT (COALESCE(v_disc_obj->>'reason_code', '') = ANY (c_motivos)) THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: motivo de descuento (cobro %)', v_tmp USING ERRCODE = 'P0001';
                END IF;
                IF v_disc_obj->>'reason_code' = 'otro'
                   AND length(btrim(COALESCE(v_disc_obj->>'reason_text', ''))) < 3 THEN
                    RAISE EXCEPTION 'MOTIVO_REQUERIDO: el motivo «otro» exige texto (cobro %)', v_tmp USING ERRCODE = 'P0001';
                END IF;
                IF NULLIF(v_disc_obj->>'value', '') IS NOT NULL THEN
                    v_it := public._plan_aplicar_ajuste(v_it, 'descuento', v_disc_obj->>'basis',
                        (v_disc_obj->>'value')::numeric, 'linea', v_context,
                        v_disc_obj->>'reason_code', v_disc_obj->>'reason_text');
                END IF;
            END IF;
            -- Condonación del recargo (sin value = todo el recargo).
            IF jsonb_typeof(v_pe->'waive_late_fee') = 'object' THEN
                v_it := public._plan_aplicar_ajuste(v_it, 'condonacion_recargo', 'valor',
                    NULLIF(v_pe#>>'{waive_late_fee,value}', '')::numeric, 'linea', v_context,
                    'condonacion_mora', v_pe#>>'{waive_late_fee,reason_text}');
            END IF;
            -- Exoneración.
            IF v_exon_obj IS NOT NULL THEN
                IF length(btrim(COALESCE(v_exon_obj->>'reason_text', ''))) < 3 THEN
                    RAISE EXCEPTION 'MOTIVO_REQUERIDO: la exoneración exige motivo (cobro %)', v_tmp USING ERRCODE = 'P0001';
                END IF;
                IF (v_it->>'is_mens')::boolean AND (v_it->>'late')::numeric > 0 THEN
                    v_it := public._plan_aplicar_ajuste(v_it, 'condonacion_recargo', 'valor',
                        (v_it->>'late')::numeric, 'linea', v_context, 'condonacion_mora', v_exon_obj->>'reason_text');
                END IF;
                v_it := public._plan_aplicar_ajuste(v_it, 'exoneracion', 'valor', NULL, 'linea', v_context,
                    COALESCE(NULLIF(v_exon_obj->>'reason_code', ''),
                             CASE WHEN (v_it->>'is_mens')::boolean THEN 'beca' ELSE 'cortesia' END),
                    v_exon_obj->>'reason_text');
                v_exon_n := v_exon_n + 1;
                v_exon_t := v_exon_t + (v_it->>'amount_before')::numeric;
            END IF;
        END IF;

        v_it := v_it || jsonb_build_object(
            'pay_spec', to_jsonb(v_pay),
            'close_mode', v_close,
            'close_reason_code', v_disc_obj->>'reason_code',
            'close_reason_text', v_disc_obj->>'reason_text',
            'context', v_context);
        v_items := v_items || v_it;
    END LOOP;

    -- ── 4. Descuento general (§15.3) ────────────────────────────────────────
    IF p_global_discount IS NOT NULL AND jsonb_typeof(p_global_discount) = 'object' THEN
        v_g_basis  := p_global_discount->>'basis';
        v_g_value  := NULLIF(p_global_discount->>'value', '')::numeric;
        v_g_reason := p_global_discount->>'reason_code';
        v_g_text   := p_global_discount->>'reason_text';
        SELECT array_agg(x) INTO v_g_refs FROM jsonb_array_elements_text(COALESCE(p_global_discount->'line_refs', '[]'::jsonb)) x;
        IF v_g_basis NOT IN ('porcentaje', 'valor') OR v_g_value IS NULL OR v_g_value <= 0
           OR (v_g_basis = 'porcentaje' AND v_g_value > 100) OR v_g_value > 20000000
           OR NOT (COALESCE(v_g_reason, '') = ANY (c_motivos)) OR COALESCE(array_length(v_g_refs, 1), 0) = 0 THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: descuento general (basis, value, reason_code, line_refs)' USING ERRCODE = 'P0001';
        END IF;
        IF v_g_reason = 'otro' AND length(btrim(COALESCE(v_g_text, ''))) < 3 THEN
            RAISE EXCEPTION 'MOTIVO_REQUERIDO: el motivo «otro» exige texto (descuento general)' USING ERRCODE = 'P0001';
        END IF;

        -- Ítems elegidos (en multi, 'new:<i>' alcanza a la línea i de cada atleta).
        FOR v_i IN 1 .. COALESCE(array_length(v_items, 1), 0) LOOP
            v_it := v_items[v_i];
            IF (v_it->>'ref') = ANY (v_g_refs) THEN
                IF COALESCE((v_it->>'exonerated')::boolean, false) THEN
                    RAISE EXCEPTION 'DATOS_INVALIDOS: el descuento general no aplica a una línea exonerada (%)', v_it->>'ref' USING ERRCODE = 'P0001';
                END IF;
                IF (v_it->>'type') = 'new' AND NOT (v_it->>'will_create')::boolean THEN
                    CONTINUE;
                END IF;
                IF jsonb_array_length(v_it->'errors') > 0 THEN
                    CONTINUE;
                END IF;
                IF (v_it->>'category') = 'excedente' AND v_role NOT IN ('owner', 'platform_admin') THEN
                    RAISE EXCEPTION 'FORBIDDEN: solo el dueño de la escuela descuenta horas de más' USING ERRCODE = '42501';
                END IF;
                v_g_idx := v_g_idx || v_i;
            END IF;
        END LOOP;
        -- Toda referencia tiene que existir.
        FOREACH v_tmp IN ARRAY v_g_refs LOOP
            IF NOT EXISTS (SELECT 1 FROM unnest(v_items) x WHERE x->>'ref' = v_tmp) THEN
                RAISE EXCEPTION 'DATOS_INVALIDOS: line_ref % no existe', v_tmp USING ERRCODE = 'P0001';
            END IF;
        END LOOP;

        IF v_g_basis = 'porcentaje' OR p_mode = 'multi' THEN
            -- % igual por línea; en modo varios también el valor fijo es por línea (§15.7).
            FOREACH v_i IN ARRAY v_g_idx LOOP
                v_items[v_i] := public._plan_aplicar_ajuste(v_items[v_i], 'descuento', v_g_basis, v_g_value,
                    'general', COALESCE(v_items[v_i]->>'context', 'al_crear'), v_g_reason, v_g_text);
            END LOOP;
        ELSE
            -- Valor fijo: prorrateo por lo que falta descontar de cada línea, con
            -- resto mayor; la línea que toca su piso se recorta y el sobrante se
            -- reparte entre las demás.
            v_g_w := '{}'; v_g_cap := '{}'; v_g_share := '{}'; v_g_active := '{}';
            FOR v_k IN 1 .. COALESCE(array_length(v_g_idx, 1), 0) LOOP
                v_it := v_items[v_g_idx[v_k]];
                v_floor := COALESCE((v_it->>'paid')::numeric, 0) + COALESCE((v_it->>'epd')::numeric, 0);
                v_g_w := v_g_w || GREATEST(COALESCE(NULLIF(v_it->>'list', '')::numeric,
                                                    (v_it->>'amount')::numeric - (v_it->>'late')::numeric)
                                           - COALESCE((v_it->>'disc')::numeric, 0), 0);
                v_g_cap := v_g_cap || GREATEST(LEAST(v_g_w[v_k],
                                                     (v_it->>'amount')::numeric
                                                     - CASE WHEN v_floor > 0 THEN v_floor ELSE 1 END), 0);
                v_g_share := v_g_share || 0::numeric;
                v_g_active := v_g_active || (v_g_cap[v_k] > 0);
            END LOOP;
            v_g_rem := round(v_g_value);
            LOOP
                v_g_tot := 0;
                FOR v_k IN 1 .. COALESCE(array_length(v_g_idx, 1), 0) LOOP
                    IF v_g_active[v_k] THEN v_g_tot := v_g_tot + v_g_w[v_k]; END IF;
                END LOOP;
                EXIT WHEN v_g_rem <= 0 OR v_g_tot <= 0;
                -- Reparto proporcional con resto mayor sobre lo que queda.
                v_g_frac := '{}'; v_g_sum := 0;
                FOR v_k IN 1 .. array_length(v_g_idx, 1) LOOP
                    IF v_g_active[v_k] THEN
                        v_g_frac := v_g_frac || (v_g_rem * v_g_w[v_k] / v_g_tot);
                        v_g_sum := v_g_sum + floor(v_g_rem * v_g_w[v_k] / v_g_tot);
                    ELSE
                        v_g_frac := v_g_frac || NULL::numeric;
                    END IF;
                END LOOP;
                v_g_left := v_g_rem - v_g_sum;
                -- tentativos: floor + 1 a los de mayor resto
                DECLARE
                    v_tent numeric[] := '{}';
                    v_ord  integer;
                BEGIN
                    FOR v_k IN 1 .. array_length(v_g_idx, 1) LOOP
                        v_tent := v_tent || CASE WHEN v_g_active[v_k] THEN floor(v_g_frac[v_k]) ELSE 0 END;
                    END LOOP;
                    FOR v_ord IN
                        SELECT k FROM generate_series(1, array_length(v_g_idx, 1)) k
                         WHERE v_g_active[k]
                         ORDER BY (v_g_frac[k] - floor(v_g_frac[k])) DESC, k
                         LIMIT v_g_left::int
                    LOOP
                        v_tent[v_ord] := v_tent[v_ord] + 1;
                    END LOOP;
                    -- ¿alguien se pasa de su tope?
                    v_g_any_sat := false;
                    FOR v_k IN 1 .. array_length(v_g_idx, 1) LOOP
                        IF v_g_active[v_k] AND v_g_share[v_k] + v_tent[v_k] >= v_g_cap[v_k] THEN
                            v_g_any_sat := true;
                            v_g_rem := v_g_rem - (v_g_cap[v_k] - v_g_share[v_k]);
                            v_g_share[v_k] := v_g_cap[v_k];
                            v_g_active[v_k] := false;
                        END IF;
                    END LOOP;
                    IF NOT v_g_any_sat THEN
                        FOR v_k IN 1 .. array_length(v_g_idx, 1) LOOP
                            IF v_g_active[v_k] THEN
                                v_g_share[v_k] := v_g_share[v_k] + v_tent[v_k];
                            END IF;
                        END LOOP;
                        v_g_rem := 0;
                    END IF;
                END;
            END LOOP;
            IF v_g_rem > 0 THEN
                v_errors := v_errors || jsonb_build_object('ref', 'global', 'code', 'DESCUENTO_EXCEDE',
                                                           'max', round(v_g_value) - v_g_rem);
            ELSE
                FOR v_k IN 1 .. COALESCE(array_length(v_g_idx, 1), 0) LOOP
                    IF v_g_share[v_k] > 0 THEN
                        v_items[v_g_idx[v_k]] := public._plan_aplicar_ajuste(v_items[v_g_idx[v_k]],
                            'descuento', 'valor', v_g_share[v_k], 'general',
                            COALESCE(v_items[v_g_idx[v_k]]->>'context', 'al_crear'), v_g_reason, v_g_text);
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END IF;

    -- ── 5. Pago: cerrar con descuento o abono; estado resultante ────────────
    FOR v_i IN 1 .. COALESCE(array_length(v_items, 1), 0) LOOP
        v_it := v_items[v_i];
        IF (v_it->>'type') = 'new' AND NOT (v_it->>'will_create')::boolean THEN
            CONTINUE;
        END IF;
        IF jsonb_array_length(v_it->'errors') > 0 THEN
            CONTINUE;
        END IF;
        v_saldo := (v_it->>'amount')::numeric - (v_it->>'paid')::numeric - (v_it->>'epd')::numeric;
        v_pay := CASE WHEN v_it->'pay_spec' = '"full"'::jsonb THEN v_saldo
                      ELSE COALESCE((v_it->>'pay_spec')::numeric, 0) END;
        v_close := COALESCE(v_it->>'close_mode', 'abono');

        IF v_pay > 0 OR (v_close = 'cerrar' AND p_payment IS NOT NULL) THEN
            IF v_pay > v_saldo THEN
                v_it := jsonb_set(v_it, '{errors}', (v_it->'errors') || jsonb_build_object(
                    'ref', v_it->>'ref', 'code', 'SOBREPAGO', 'max', v_saldo));
            ELSE
                IF v_pay < v_saldo AND v_close = 'cerrar' THEN
                    v_cr_code := v_it->>'close_reason_code';
                    v_cr_text := v_it->>'close_reason_text';
                    IF v_cr_code IS NULL THEN
                        v_it := jsonb_set(v_it, '{errors}', (v_it->'errors') || jsonb_build_object(
                            'ref', v_it->>'ref', 'code', 'MOTIVO_REQUERIDO',
                            'detail', '¿por qué se cierra por menos?'));
                    ELSE
                        v_it := public._plan_aplicar_ajuste(v_it, 'descuento', 'valor', v_saldo - v_pay,
                            'linea', 'al_pagar', v_cr_code, v_cr_text, jsonb_build_object('cierre', true));
                    END IF;
                END IF;
                IF jsonb_array_length(v_it->'errors') = 0 AND v_pay > 0 THEN
                    v_it := v_it || jsonb_build_object(
                        'pay_amount', v_pay,
                        'paid', (v_it->>'paid')::numeric + v_pay,
                        'status', CASE WHEN (v_it->>'paid')::numeric + v_pay + (v_it->>'epd')::numeric
                                            >= (v_it->>'amount')::numeric
                                       THEN 'paid' ELSE 'partial' END);
                END IF;
            END IF;
        END IF;
        IF NOT (v_it ? 'pay_amount') THEN
            v_it := v_it || jsonb_build_object('pay_amount', 0);
        END IF;
        v_items[v_i] := v_it;
    END LOOP;

    -- ── 6. Avisos, totales, errores, hash ───────────────────────────────────
    FOR v_i IN 1 .. COALESCE(array_length(v_items, 1), 0) LOOP
        v_it := v_items[v_i];
        -- Aviso del 50 % (D16): descuentos + pronto pago sobre el valor de lista.
        IF NULLIF(v_it->>'list', '') IS NOT NULL AND (v_it->>'list')::numeric > 0
           AND ((v_it->>'disc')::numeric + COALESCE((v_it->>'epd')::numeric, 0)) / (v_it->>'list')::numeric > 0.5
           AND NOT COALESCE((v_it->>'exonerated')::boolean, false) THEN
            v_it := jsonb_set(v_it, '{warnings}', (v_it->'warnings') || '"descuento_total_mayor_50"'::jsonb);
        END IF;
        v_items[v_i] := v_it;

        v_errors := v_errors || COALESCE(v_it->'errors', '[]'::jsonb);

        IF (v_it->>'type') = 'new' AND (v_it->>'will_create')::boolean THEN
            v_to_create_n := v_to_create_n + 1;
            v_to_create_t := v_to_create_t + (v_it->>'amount')::numeric;
            v_by_cat := jsonb_set(v_by_cat, ARRAY[v_it->>'category'], jsonb_build_object(
                'n', COALESCE((v_by_cat#>>ARRAY[v_it->>'category', 'n'])::int, 0) + 1,
                'total', COALESCE((v_by_cat#>>ARRAY[v_it->>'category', 'total'])::numeric, 0) + (v_it->>'amount')::numeric));
        END IF;
        IF COALESCE((v_it->>'pay_amount')::numeric, 0) > 0 THEN
            v_to_pay_n := v_to_pay_n + 1;
            v_to_pay_t := v_to_pay_t + (v_it->>'pay_amount')::numeric;
        END IF;
        FOR v_a IN SELECT value FROM jsonb_array_elements(COALESCE(v_it->'adjustments', '[]'::jsonb)) LOOP
            IF v_a->>'kind' IN ('descuento', 'exoneracion') THEN
                v_disc_t := v_disc_t + (v_a->>'amount')::numeric;
                v_by_reason := jsonb_set(v_by_reason, ARRAY[v_a->>'reason_code'],
                    to_jsonb(COALESCE((v_by_reason->>(v_a->>'reason_code'))::numeric, 0) + (v_a->>'amount')::numeric));
            ELSIF v_a->>'kind' = 'condonacion_recargo' THEN
                v_waived_t := v_waived_t + (v_a->>'amount')::numeric;
            END IF;
        END LOOP;

        v_canon := v_canon || jsonb_build_object(
            'r', v_it->>'ref', 'a', v_it->>'athlete', 'c', v_it->>'category',
            'w', v_it->'will_create', 's', v_it->>'skip_reason_raw',
            'l', v_it->'list', 'b', v_it->'amount_before', 'pb', v_it->'paid_before',
            'm', v_it->'amount', 'p', v_it->'pay_amount', 'st', v_it->>'status');

        IF (v_it->>'type') = 'new' THEN
            v_items_out := v_items_out || v_it;
        ELSE
            v_pend_out := v_pend_out || v_it;
        END IF;
    END LOOP;

    FOR v_i IN 1 .. COALESCE(array_length(v_ath, 1), 0) LOOP
        v_ath_out := v_ath_out || v_ath[v_i];
    END LOOP;

    RETURN jsonb_build_object(
        'mode', p_mode,
        'actor_role', v_role,
        'athletes', v_ath_out,
        'items', v_items_out,
        'pending', v_pend_out,
        'skipped', v_skipped,
        'errors', v_errors,
        'rows_to_create', v_to_create_n,
        'total_amount', v_to_create_t,
        'by_category', v_by_cat,
        'to_create', jsonb_build_object('n', v_to_create_n, 'total', v_to_create_t),
        'to_pay', jsonb_build_object('n', v_to_pay_n, 'total', v_to_pay_t),
        'discounts', jsonb_build_object('total', v_disc_t, 'by_reason', v_by_reason),
        'late_fee_waived', v_waived_t,
        'exonerated', jsonb_build_object('n', v_exon_n, 'total', v_exon_t),
        'warnings_count', jsonb_build_object('sin_acudiente', v_sin_acud),
        'preview_hash', md5(jsonb_build_object('mode', p_mode, 'items', v_canon,
                                               'global', p_global_discount)::text));
END;
$function$;

-- ── create_enrollment_with_payments ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_enrollment_with_payments(p_school_id uuid, p_enrollment jsonb, p_payments jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_enr         public.enrollments;
  v_enr_id      uuid;
  v_elem        jsonb;
  v_pay         public.payments;
  v_athlete     uuid;
  v_ids         uuid[] := ARRAY[]::uuid[];
  v_fee_ids     uuid[];
  v_id          uuid;
  -- F2 hermanos escalonado (20261013192955)
  v_sib_of      uuid;
  v_sib_got     numeric;
  v_sib_exp     numeric;
  v_sib_pct     numeric;
  v_sib_list    numeric;
  v_sib_manual  boolean;
BEGIN
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'create_enrollment_with_payments: school_id obligatorio' USING ERRCODE = '22023';
  END IF;
  IF p_payments IS NOT NULL AND jsonb_typeof(p_payments) NOT IN ('array', 'null') THEN
    RAISE EXCEPTION 'create_enrollment_with_payments: p_payments debe ser un arreglo' USING ERRCODE = '22023';
  END IF;

  -- ── 1. Inscripción ─────────────────────────────────────────────────────────
  IF p_enrollment IS NOT NULL AND jsonb_typeof(p_enrollment) = 'object' THEN
    v_enr := jsonb_populate_record(NULL::public.enrollments, p_enrollment);

    IF v_enr.offering_plan_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.offering_plans op
          WHERE op.id = v_enr.offering_plan_id AND op.school_id = p_school_id) THEN
      RAISE EXCEPTION 'plan_no_encontrado: el plan % no pertenece a la escuela', v_enr.offering_plan_id
        USING ERRCODE = 'P0002';
    END IF;

    v_athlete := COALESCE(v_enr.child_id, v_enr.user_id, v_enr.unregistered_athlete_id);
    IF v_athlete IS NOT NULL THEN
      -- Misma llave que emit_enrollment_fees: serializa altas del mismo atleta.
      PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));
    END IF;
    -- F2 hermanos escalonado (20261013192955): el rango de hermanos depende
    -- de las demás altas de la escuela, así que se serializan por escuela
    -- (misma llave que _sibling_link_core / unlink_sibling).
    IF v_enr.child_id IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('siblings:' || p_school_id::text, 0));
    END IF;

    INSERT INTO public.enrollments (
      school_id, child_id, user_id, unregistered_athlete_id, team_id,
      offering_plan_id, offering_id, start_date, status, monthly_fee, first_payment_mode
    ) VALUES (
      p_school_id, v_enr.child_id, v_enr.user_id, v_enr.unregistered_athlete_id, v_enr.team_id,
      v_enr.offering_plan_id, v_enr.offering_id,
      COALESCE(v_enr.start_date, (now() AT TIME ZONE 'America/Bogota')::date),
      COALESCE(v_enr.status, 'active'), v_enr.monthly_fee, v_enr.first_payment_mode
    )
    RETURNING id INTO v_enr_id;

    -- F2 hermanos escalonado (20261013192955): hermano señalado en el alta
    -- (acudiente sin cuenta) = vínculo 'alta'. Nunca se escribe parent_id.
    v_sib_of := NULLIF(p_enrollment->>'sibling_of_child_id', '')::uuid;
    IF v_sib_of IS NOT NULL THEN
      IF v_enr.child_id IS NULL THEN
        RAISE EXCEPTION 'hermanos_datos_invalidos: sibling_of_child_id solo aplica a menores'
          USING ERRCODE = '22023';
      END IF;
      PERFORM public._sibling_link_core(p_school_id, ARRAY[v_enr.child_id, v_sib_of], 'alta',
                                        NULLIF(p_enrollment->>'actor_id', '')::uuid);
    END IF;
  END IF;

  -- ── 2. Cobros ──────────────────────────────────────────────────────────────
  FOR v_elem IN SELECT value FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    -- 2a. Inscripción + seguro: misma función que usa POST /enrollments.
    IF v_elem->>'kind' = 'enrollment_fees' THEN
      v_fee_ids := public.emit_enrollment_fees(
        p_school_id,
        NULLIF(v_elem->>'plan_id', '')::uuid,
        NULLIF(v_elem->>'child_id', '')::uuid,
        NULLIF(v_elem->>'user_id', '')::uuid,
        NULLIF(v_elem->>'unregistered_athlete_id', '')::uuid,
        NULLIF(v_elem->>'parent_id', '')::uuid,
        NULLIF(v_elem->>'branch_id', '')::uuid,
        NULLIF(v_elem->>'due_date', '')::date,
        v_elem->>'person_name',
        COALESCE((v_elem->>'waive_registration_fee')::boolean, false),
        COALESCE((v_elem->>'waive_insurance_fee')::boolean, false)
      );
      v_ids := v_ids || COALESCE(v_fee_ids, ARRAY[]::uuid[]);
      CONTINUE;
    END IF;

    -- 2b. Cobro con período (mensualidad / parcial / mes siguiente).
    v_pay := jsonb_populate_record(NULL::public.payments, v_elem);
    v_athlete := COALESCE(v_pay.child_id, v_pay.user_id, v_pay.unregistered_athlete_id);
    IF v_athlete IS NULL THEN
      RAISE EXCEPTION 'create_enrollment_with_payments: cobro sin atleta' USING ERRCODE = '22023';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_athlete::text, 0));

    -- Mismo predicado que uniq_payment_active_period_* (por eso sin school_id):
    -- se adelanta al 23505 con un mensaje que el BFF traduce a 409.
    IF v_pay.period_year IS NOT NULL AND v_pay.period_month IS NOT NULL
       AND NOT COALESCE(v_pay.period_uniqueness_exempt, false)
       AND EXISTS (
         SELECT 1 FROM public.payments p
          WHERE p.period_year  = v_pay.period_year
            AND p.period_month = v_pay.period_month
            AND p.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
            AND NOT p.period_uniqueness_exempt
            AND (
                  (v_pay.child_id IS NOT NULL AND p.child_id = v_pay.child_id)
               OR (v_pay.child_id IS NULL AND v_pay.user_id IS NOT NULL
                     AND p.child_id IS NULL AND p.user_id = v_pay.user_id)
               OR (v_pay.unregistered_athlete_id IS NOT NULL
                     AND p.unregistered_athlete_id = v_pay.unregistered_athlete_id)
            )
       ) THEN
      RAISE EXCEPTION 'periodo_ocupado:%', to_char(make_date(v_pay.period_year, v_pay.period_month, 1), 'YYYY-MM')
        USING ERRCODE = 'P0001';
    END IF;

    -- F2 hermanos escalonado (20261013192955): el BFF manda el descuento de
    -- hermanos que cotizó; aquí (con el candado de la escuela) se recalcula y si
    -- no coincide (±1) se rechaza: otra alta cambió el rango entre la cotización
    -- y el guardado. Sin la llave (BFF anterior) el cobro nace como antes.
    IF v_elem ? 'sibling_discount_applied' THEN
      v_sib_got := COALESCE(v_pay.sibling_discount_applied, 0);
      v_sib_exp := 0;
      IF v_pay.child_id IS NOT NULL THEN
        SELECT COALESCE(bool_or(e.fee_is_manual), false) INTO v_sib_manual
          FROM public.enrollments e
         WHERE e.school_id = p_school_id AND e.child_id = v_pay.child_id AND e.status = 'active';
        IF NOT COALESCE(v_sib_manual, false) THEN
          v_sib_pct  := public._sibling_tier_pct(p_school_id, public._sibling_rank(p_school_id, v_pay.child_id));
          v_sib_list := COALESCE(v_pay.list_amount, v_pay.amount + v_sib_got);
          v_sib_exp  := round(v_sib_list * v_sib_pct / 100);
        END IF;
      END IF;
      IF abs(v_sib_exp - v_sib_got) > 1 THEN
        RAISE EXCEPTION 'hermanos_desactualizado: descuento esperado %, recibido %', v_sib_exp, v_sib_got
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    INSERT INTO public.payments (
      school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
      team_id, offering_plan_id, amount, concept, due_date, status, payment_type,
      period_year, period_month, payment_category, period_uniqueness_exempt,
      discount_pct, list_amount, sibling_discount_applied
    ) VALUES (
      p_school_id, v_pay.branch_id, v_pay.parent_id, v_pay.child_id, v_pay.user_id,
      v_pay.unregistered_athlete_id, v_pay.team_id, v_pay.offering_plan_id,
      v_pay.amount, v_pay.concept, v_pay.due_date, 'pending',
      COALESCE(v_pay.payment_type, 'subscription'),
      v_pay.period_year, v_pay.period_month, v_pay.payment_category,
      COALESCE(v_pay.period_uniqueness_exempt, false),
      v_pay.discount_pct, v_pay.list_amount, NULLIF(v_pay.sibling_discount_applied, 0)
    )
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;

  RETURN jsonb_build_object('enrollment_id', v_enr_id, 'payment_ids', to_jsonb(v_ids));
END;
$function$;

-- ── ACLs: CREATE OR REPLACE conserva las vivas; se re-afirman ───────────────
-- open_month / preview_open_month: authenticated + service_role (gate interno).
-- El resto: solo service_role.
REVOKE ALL ON FUNCTION public.open_month(uuid, integer, integer, uuid)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_month(uuid, integer, integer, uuid)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_open_month(uuid, integer, integer, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._descuentos_automaticos_calc(public.payments) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._plan_charge_operation(uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._descuentos_automaticos_calc(public.payments) TO service_role;
GRANT EXECUTE ON FUNCTION public._plan_charge_operation(uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_enrollment_with_payments(uuid, jsonb, jsonb) TO service_role;

COMMIT;
