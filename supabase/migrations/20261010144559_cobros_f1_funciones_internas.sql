-- =============================================================================
-- 20261010144559_cobros_f1_funciones_internas.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144558
-- Objetivo: F1 de «Cobros y pagos» (spec cobros-multiples §7.1, §7.5, §16.3, §12 M8).
--   Funciones INTERNAS (solo service_role; nunca authenticated/anon):
--     _actor_rol_finanzas          ¿p_actor administra p_school_id? (sin auth.uid():
--                                  con service role auth.uid() es NULL — gotchas)
--     _resolve_payment_payer       pagador (D5): menor → children.parent_id; adulto y
--                                  sin cuenta → NULL (el adulto paga como user_id)
--     _charge_duplicate_reason     §7.1 (una sola regla de duplicados por línea)
--     _confirm_overage_into_payment  extraída de confirm_hour_bank_overage
--     confirm_hour_bank_overage    CREATE OR REPLACE: ahora delega; MISMO
--                                  comportamiento y misma respuesta (cuerpo vivo de
--                                  2026-10-10 movido a la interna sin cambios de regla)
--     _find_athlete_duplicates     §16.3
--     _ajuste_calcular             reglas de §7.5 en una función PURA (la usan el
--                                  planificador y _apply_payment_adjustment: preview
--                                  y create no pueden divergir)
--     _apply_payment_adjustment    §7.5 (escribe; exige la fila bloqueada)
--     _registrar_pago_en_cobro     §7.3 paso 9d (escribe)
--     _plan_aplicar_ajuste         paso puro del planificador
--     _plan_charge_operation       cálculo compartido preview/create (§7.2)
--
-- Códigos de error (prefijo del mensaje, ERRCODE P0001 salvo que se diga):
--   FORBIDDEN (42501) · ESCUELA_NO_OPERATIVA · DATOS_INVALIDOS · TOPE_EXCEDIDO ·
--   ATLETA_AJENO · MULTI_NO_PAGA · SOLO_OWNER_EXCEDENTE · EXCEDENTE_NO_DISPONIBLE ·
--   EN_REVISION · COBRO_CAMBIO · COBRO_CERRADO · PAGO_EN_CURSO · DESCUENTO_EXCEDE ·
--   SOBREPAGO · EXONERACION_CON_PAGO · MOTIVO_REQUERIDO · SIN_RECARGO · PREVIEW_STALE.
--   El planificador NO lanza los errores por línea: los devuelve en "errors"
--   (la vista previa los muestra; create_charge_batch lanza el primero).
--
-- Radio (base viva, 2026-10-10, solo lectura):
--   · Funciones nuevas: ninguna existe (pg_proc). Nadie las llama hasta M9/F2.
--   · confirm_hour_bank_overage: 1 llamador (BFF routes/access-api.ts:1224, solo
--     owner). hour_bank_overage_charges: 1 fila 'suggested' (Dreamers). La
--     respuesta JSON y las filas que crea son idénticas a las de hoy.
--   · PAGO_EN_CURSO: marca = payment_links con status 'pending' y expires_at > now()
--     (enlace firmado con monto; dura 3 días). Hoy: 11 vigentes, 79 pending en total.
--     Cobros abiertos con wompi_transaction_id/provider_transaction_id: 0 (no sirve
--     de marca). Abonos del acudiente en revisión (payment_installments
--     pending_review): 0.
-- =============================================================================

BEGIN;

-- ── _actor_rol_finanzas ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._actor_rol_finanzas(p_school_id uuid, p_actor uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_role text;
BEGIN
    IF p_school_id IS NULL OR p_actor IS NULL THEN
        RETURN NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM public.schools s WHERE s.id = p_school_id AND s.owner_id = p_actor) THEN
        RETURN 'owner';
    END IF;
    SELECT sm.role INTO v_role
      FROM public.school_members sm
     WHERE sm.profile_id = p_actor
       AND sm.school_id  = p_school_id
       AND sm.status     = 'active'
       AND sm.role IN ('owner', 'admin', 'school_admin', 'super_admin')
     ORDER BY CASE sm.role WHEN 'owner' THEN 1 WHEN 'super_admin' THEN 2
                           WHEN 'admin' THEN 3 ELSE 4 END
     LIMIT 1;
    IF v_role IS NOT NULL THEN
        RETURN v_role;
    END IF;
    IF EXISTS (SELECT 1 FROM public.platform_admins pa
                WHERE pa.profile_id = p_actor AND pa.is_active = true) THEN
        RETURN 'platform_admin';
    END IF;
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._actor_rol_finanzas(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._actor_rol_finanzas(uuid, uuid) TO service_role;

-- ── _resolve_payment_payer (D5) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._resolve_payment_payer(p_child_id uuid, p_user_id uuid, p_unreg_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
    -- Menor → su acudiente (NULL si aún no tiene: trg_backfill_payment_payer_on_link
    -- lo completa al vincular). Adulto con cuenta → paga como user_id (parent_id
    -- NULL, igual que open_month). Adulto sin cuenta → NULL.
    SELECT CASE
        WHEN p_child_id IS NOT NULL
            THEN (SELECT c.parent_id FROM public.children c WHERE c.id = p_child_id)
        ELSE NULL
    END;
$function$;

REVOKE ALL ON FUNCTION public._resolve_payment_payer(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._resolve_payment_payer(uuid, uuid, uuid) TO service_role;

-- ── _charge_duplicate_reason (§7.1) ─────────────────────────────────────────
-- p_athlete: {child_id, user_id, unregistered_athlete_id}
-- p_line:    {category, period_year, period_month, amount, concept, overage_charge_id}
CREATE OR REPLACE FUNCTION public._charge_duplicate_reason(p_school_id uuid, p_athlete jsonb, p_line jsonb)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_today  date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_child  uuid := NULLIF(p_athlete->>'child_id', '')::uuid;
    v_user   uuid := NULLIF(p_athlete->>'user_id', '')::uuid;
    v_unreg  uuid := NULLIF(p_athlete->>'unregistered_athlete_id', '')::uuid;
    v_cat    text := p_line->>'category';
    v_py     int  := NULLIF(p_line->>'period_year', '')::int;
    v_pm     int  := NULLIF(p_line->>'period_month', '')::int;
    v_amount numeric := NULLIF(p_line->>'amount', '')::numeric;
    v_concept text := p_line->>'concept';
    v_ov     uuid := NULLIF(p_line->>'overage_charge_id', '')::uuid;
    v_row    record;
BEGIN
    IF v_cat = 'excedente' THEN
        SELECT o.status, o.payment_id INTO v_row
          FROM public.hour_bank_overage_charges o
         WHERE o.id = v_ov AND o.school_id = p_school_id;
        IF NOT FOUND OR v_row.status <> 'suggested' OR v_row.payment_id IS NOT NULL THEN
            RETURN 'excedente_ya_facturado';
        END IF;
    END IF;

    IF v_cat = 'mensualidad' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.enrollments e
             WHERE e.school_id = p_school_id
               AND e.status <> 'cancelled'
               AND (e.offering_plan_id IS NOT NULL OR e.team_id IS NOT NULL)
               AND (   (v_child IS NOT NULL AND e.child_id = v_child)
                    OR (v_user  IS NOT NULL AND e.user_id  = v_user)
                    OR (v_unreg IS NOT NULL AND e.unregistered_athlete_id = v_unreg))
        ) THEN
            RETURN 'sin_inscripcion_para_mensualidad';
        END IF;

        -- Mismo predicado que uniq_payment_active_period_per_{child,adult,unreg}.
        IF EXISTS (
            SELECT 1 FROM public.payments p
             WHERE p.period_year  = v_py
               AND p.period_month = v_pm
               AND p.status IN ('pending','awaiting_approval','paid','partial','overdue','glosado')
               AND NOT p.period_uniqueness_exempt
               AND (   (v_child IS NOT NULL AND p.child_id = v_child)
                    OR (v_child IS NULL AND v_user IS NOT NULL AND p.child_id IS NULL AND p.user_id = v_user)
                    OR (v_unreg IS NOT NULL AND p.unregistered_athlete_id = v_unreg))
        ) THEN
            RETURN 'mensualidad_ya_existe';
        END IF;
    END IF;

    -- Seguro: misma regla que emit_enrollment_fees (por categoría, 365 días).
    IF v_cat = 'seguro' AND EXISTS (
        SELECT 1 FROM public.payments p
         WHERE p.school_id = p_school_id
           AND p.payment_category = 'seguro'
           AND p.status <> 'cancelled'
           AND p.due_date > v_today - 365
           AND (   (v_child IS NOT NULL AND p.child_id = v_child)
                OR (v_user  IS NOT NULL AND p.user_id  = v_user AND p.child_id IS NULL)
                OR (v_unreg IS NOT NULL AND p.unregistered_athlete_id = v_unreg))
    ) THEN
        RETURN 'seguro_en_12_meses';
    END IF;

    -- Doble lote por error (otro client_request_id) en las últimas 24 h.
    IF EXISTS (
        SELECT 1 FROM public.payments p
         WHERE p.school_id = p_school_id
           AND p.payment_category = v_cat
           AND (p.amount = v_amount OR p.list_amount = v_amount)
           AND p.concept = v_concept
           AND p.created_at > now() - interval '24 hours'
           AND p.status <> 'cancelled'
           AND (   (v_child IS NOT NULL AND p.child_id = v_child)
                OR (v_user  IS NOT NULL AND p.user_id  = v_user AND p.child_id IS NULL)
                OR (v_unreg IS NOT NULL AND p.unregistered_athlete_id = v_unreg))
    ) THEN
        RETURN 'misma_linea_hoy';
    END IF;

    -- 'fee_unica_vez' llega con plan_one_time_fees (F4 / pagos-únicos F1).
    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._charge_duplicate_reason(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._charge_duplicate_reason(uuid, jsonb, jsonb) TO service_role;

-- ── _confirm_overage_into_payment + confirm_hour_bank_overage ───────────────
-- Cuerpo vivo de confirm_hour_bank_overage (pg_get_functiondef 2026-10-10)
-- movido aquí. Parámetros nuevos (todos opcionales) para el lote:
--   p_amount      monto del cobro (default: el de la fila sugerida)
--   p_due_date    vencimiento (default: hoy Bogotá + 5, decisión 2026-10-05)
--   p_batch_id    charge_batches.id (estampa charge_batch_id y created_by)
--   p_payment_id  id del cobro a crear (el lote lo pre-genera)
--   p_notes       nota interna
CREATE OR REPLACE FUNCTION public._confirm_overage_into_payment(
    p_id uuid,
    p_actor uuid,
    p_amount numeric DEFAULT NULL,
    p_due_date date DEFAULT NULL,
    p_batch_id uuid DEFAULT NULL,
    p_payment_id uuid DEFAULT NULL,
    p_notes text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_row        public.hour_bank_overage_charges%ROWTYPE;
  v_period     record;
  v_enr        record;
  v_payment_id uuid;
  v_today      date := (now() AT TIME ZONE 'America/Bogota')::date;
  v_months     text[] := ARRAY['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                               'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
BEGIN
  SELECT * INTO v_row
    FROM public.hour_bank_overage_charges
   WHERE id = p_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_row.status <> 'suggested' THEN
    RETURN jsonb_build_object('error', 'not_suggested', 'status', v_row.status,
                              'payment_id', v_row.payment_id);
  END IF;
  IF COALESCE(v_row.amount, 0) <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;
  IF p_amount IS NOT NULL AND p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;

  SELECT period_start INTO v_period
    FROM public.hour_bank_periods WHERE id = v_row.period_id;

  -- Mismo armado de pagador que open_month: parent_id = acudiente del menor;
  -- el adulto paga como user_id; el no registrado queda sin parent_id.
  SELECT e.child_id, e.user_id, e.unregistered_athlete_id, e.team_id,
         c.parent_id,
         COALESCE(c.branch_id, t.branch_id) AS branch_id
    INTO v_enr
    FROM public.enrollments e
    LEFT JOIN public.children c ON c.id = e.child_id
    LEFT JOIN public.teams    t ON t.id = e.team_id
   WHERE e.id = v_row.enrollment_id;

  INSERT INTO public.payments (
    id,
    school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
    team_id, offering_plan_id, amount, concept, due_date, status, payment_type,
    payment_category, period_year, period_month, period_uniqueness_exempt,
    charge_batch_id, created_by, notes
  ) VALUES (
    COALESCE(p_payment_id, gen_random_uuid()),
    v_row.school_id,
    v_enr.branch_id,
    v_enr.parent_id,
    v_enr.child_id,
    v_enr.user_id,
    v_enr.unregistered_athlete_id,
    v_enr.team_id,
    NULL,                                   -- sin plan: no extiende vigencia (B3)
    COALESCE(p_amount, v_row.amount),
    format('Horas por encima del plan — %s %s — %s h × $%s',
           v_months[extract(month FROM v_period.period_start)::int],
           extract(year FROM v_period.period_start)::int,
           public.hour_bank_fmt_es(v_row.billable_hours),
           public.hour_bank_fmt_es(v_row.hourly_rate)),
    COALESCE(p_due_date, v_today + 5),      -- decisión usuario 2026-10-05
    'pending',
    'one_time',
    'excedente',                            -- requiere F-A (CHECK)
    extract(year  FROM v_period.period_start)::smallint,
    extract(month FROM v_period.period_start)::smallint,
    true,                                   -- convive con la mensualidad del mes
    p_batch_id,
    CASE WHEN p_batch_id IS NOT NULL THEN p_actor END,
    p_notes
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.hour_bank_overage_charges
     SET status     = 'confirmed',
         payment_id = v_payment_id,
         decided_by = p_actor,
         decided_at = now(),
         updated_at = now()
   WHERE id = v_row.id;

  RETURN jsonb_build_object('payment_id', v_payment_id);
END;
$function$;

REVOKE ALL ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._confirm_overage_into_payment(uuid, uuid, numeric, date, uuid, uuid, text)
    TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_hour_bank_overage(p_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
BEGIN
  -- (cobros F1) Misma regla, ahora compartida con create_charge_batch.
  RETURN public._confirm_overage_into_payment(p_id, p_actor);
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_hour_bank_overage(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_hour_bank_overage(uuid, uuid) TO service_role;

-- ── _find_athlete_duplicates (§16.3) ────────────────────────────────────────
-- matched_by text[] con 'doc' (documento igual o casi igual con el mismo primer
-- nombre), 'nombre' (igual o prefijo) y 'telefono' (del atleta, del acudiente
-- temporal o del acudiente vinculado). Solo 'telefono' = informativo («mismo
-- acudiente que …», hermanos): no bloquea. 'doc' o 'nombre' = posible duplicado.
CREATE OR REPLACE FUNCTION public._find_athlete_duplicates(
    p_school_id uuid, p_full_name text, p_doc_number text, p_phone text)
 RETURNS TABLE(table_name text, id uuid, full_name text, doc_masked text, guardian text, matched_by text[])
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_name  text := public.normalize_athlete_name(p_full_name);
    v_first text := split_part(COALESCE(public.normalize_athlete_name(p_full_name), ''), ' ', 1);
    v_doc   text := public.normalize_doc_number(p_doc_number);
    v_phone text := NULLIF(right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10), '');
BEGIN
    IF p_school_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH cand AS (
        -- Menores (fichas activas de la escuela)
        SELECT 'children'::text AS t, c.id AS cid, c.full_name AS fname, c.doc_number AS doc,
               COALESCE(pp.full_name, c.parent_name_temp) AS guard,
               ARRAY[c.parent_phone_temp, pp.phone] AS phones
          FROM public.children c
          LEFT JOIN public.profiles pp ON pp.id = c.parent_id
         WHERE c.school_id = p_school_id AND c.is_active = true
        UNION ALL
        -- Adultos sin cuenta
        SELECT 'unregistered_athletes', ua.id, ua.full_name, ua.doc_number,
               ua.guardian_full_name,
               ARRAY[ua.phone, ua.guardian_phone]
          FROM public.unregistered_athletes ua
         WHERE ua.school_id = p_school_id AND ua.is_active = true
        UNION ALL
        -- Adultos con cuenta inscritos en la escuela
        SELECT DISTINCT 'profiles', pr.id, pr.full_name, pr.document_number,
               NULL::text,
               ARRAY[pr.phone]
          FROM public.enrollments e
          JOIN public.profiles pr ON pr.id = e.user_id
         WHERE e.school_id = p_school_id AND e.user_id IS NOT NULL
    ),
    m AS (
        SELECT cand.*,
               array_remove(ARRAY[
                 CASE WHEN (v_doc IS NOT NULL AND public.normalize_doc_number(cand.doc) = v_doc)
                        OR (public.doc_casi_igual(cand.doc, p_doc_number)
                            AND split_part(COALESCE(public.normalize_athlete_name(cand.fname), ''), ' ', 1) = v_first)
                      THEN 'doc' END,
                 CASE WHEN (v_name IS NOT NULL AND public.normalize_athlete_name(cand.fname) = v_name)
                        OR public.nombre_es_prefijo(cand.fname, p_full_name)
                      THEN 'nombre' END,
                 CASE WHEN v_phone IS NOT NULL AND EXISTS (
                         SELECT 1 FROM unnest(cand.phones) ph
                          WHERE NULLIF(right(regexp_replace(COALESCE(ph, ''), '\D', '', 'g'), 10), '') = v_phone)
                      THEN 'telefono' END
               ], NULL) AS mb
          FROM cand
    )
    SELECT m.t, m.cid, m.fname,
           CASE WHEN public.normalize_doc_number(m.doc) IS NULL THEN NULL
                ELSE '•••' || right(public.normalize_doc_number(m.doc), 4) END,
           m.guard,
           m.mb
      FROM m
     WHERE cardinality(m.mb) > 0
     ORDER BY ('doc' = ANY (m.mb)) DESC, ('nombre' = ANY (m.mb)) DESC, m.fname
     LIMIT 20;
END;
$function$;

REVOKE ALL ON FUNCTION public._find_athlete_duplicates(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._find_athlete_duplicates(uuid, text, text, text) TO service_role;

-- ── _ajuste_calcular: reglas de §7.5 (puro) ─────────────────────────────────
-- Devuelve {error, max, x, list, disc, late, waived_delta, amount, status}.
--   error NULL = se puede aplicar. status: NULL (no cambia), 'paid' (exoneración
--   de mensualidad = beca del mes), 'cancelled' (exoneración de cobro único).
CREATE OR REPLACE FUNCTION public._ajuste_calcular(
    p_kind text, p_basis text, p_value numeric,
    p_list numeric, p_disc numeric, p_late numeric,
    p_amount numeric, p_paid numeric, p_epd numeric, p_is_mens boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_late   numeric := COALESCE(p_late, 0);
    v_disc   numeric := COALESCE(p_disc, 0);
    v_list   numeric := COALESCE(p_list, p_amount - COALESCE(p_late, 0));
    v_floor  numeric := COALESCE(p_paid, 0) + COALESCE(p_epd, 0);
    v_x      numeric;
    v_new    numeric;
    v_max    numeric;
BEGIN
    IF p_kind = 'descuento' THEN
        IF p_basis = 'porcentaje' THEN
            IF p_value IS NULL OR p_value <= 0 OR p_value > 100 THEN
                RETURN jsonb_build_object('error', 'DATOS_INVALIDOS', 'detail', 'porcentaje fuera de (0, 100]');
            END IF;
            v_x := round((v_list - v_disc) * p_value / 100);
        ELSIF p_basis = 'valor' THEN
            IF p_value IS NULL OR p_value <= 0 OR p_value > 20000000 THEN
                RETURN jsonb_build_object('error', 'DATOS_INVALIDOS', 'detail', 'valor fuera de rango');
            END IF;
            v_x := round(p_value);
        ELSE
            RETURN jsonb_build_object('error', 'DATOS_INVALIDOS', 'detail', 'basis inválido');
        END IF;
        -- Máximo: el valor aún no descontado (nunca el recargo) y el piso de lo
        -- pagado; el cobro no queda en $0 (eso es exoneración).
        v_max := LEAST(v_list - v_disc,
                       p_amount - GREATEST(v_floor, CASE WHEN v_floor > 0 THEN v_floor ELSE 1 END));
        IF v_x <= 0 THEN
            RETURN jsonb_build_object('error', 'DATOS_INVALIDOS', 'detail', 'el descuento da $0');
        END IF;
        IF v_x > v_max THEN
            RETURN jsonb_build_object('error', 'DESCUENTO_EXCEDE', 'max', GREATEST(v_max, 0));
        END IF;
        v_new := p_amount - v_x;
        RETURN jsonb_build_object('error', NULL, 'x', v_x, 'list', v_list, 'disc', v_disc + v_x,
                                  'late', v_late, 'waived_delta', 0, 'amount', v_new, 'status', NULL);

    ELSIF p_kind = 'condonacion_recargo' THEN
        IF v_late <= 0 THEN
            RETURN jsonb_build_object('error', 'SIN_RECARGO');
        END IF;
        v_x := CASE
                 WHEN p_value IS NULL THEN v_late
                 WHEN p_basis = 'porcentaje' AND p_value > 0 AND p_value <= 100 THEN round(v_late * p_value / 100)
                 WHEN p_basis = 'porcentaje' THEN NULL
                 ELSE round(p_value)
               END;
        IF v_x IS NULL OR v_x <= 0 THEN
            RETURN jsonb_build_object('error', 'DATOS_INVALIDOS', 'detail', 'condonación inválida');
        END IF;
        v_max := LEAST(v_late, p_amount - CASE WHEN v_floor > 0 THEN v_floor ELSE 1 END);
        IF v_x > v_max THEN
            RETURN jsonb_build_object('error', 'DESCUENTO_EXCEDE', 'max', GREATEST(v_max, 0));
        END IF;
        v_new := p_amount - v_x;
        RETURN jsonb_build_object('error', NULL, 'x', v_x, 'list', v_list, 'disc', v_disc,
                                  'late', v_late - v_x, 'waived_delta', v_x, 'amount', v_new, 'status', NULL);

    ELSIF p_kind = 'exoneracion' THEN
        IF COALESCE(p_paid, 0) > 0 OR COALESCE(p_epd, 0) > 0 THEN
            RETURN jsonb_build_object('error', 'EXONERACION_CON_PAGO');
        END IF;
        IF p_is_mens THEN
            -- El recargo se condona antes con su propio ajuste.
            IF v_late > 0 THEN
                RETURN jsonb_build_object('error', 'DATOS_INVALIDOS', 'detail', 'condonar el recargo antes de exonerar');
            END IF;
            v_x := v_list - v_disc;
            IF v_x <= 0 THEN
                RETURN jsonb_build_object('error', 'DESCUENTO_EXCEDE', 'max', 0);
            END IF;
            RETURN jsonb_build_object('error', NULL, 'x', v_x, 'list', v_list, 'disc', v_disc + v_x,
                                      'late', 0, 'waived_delta', 0, 'amount', 0, 'status', 'paid');
        END IF;
        -- Cobro único: se anula; el ajuste registra el saldo exonerado.
        RETURN jsonb_build_object('error', NULL, 'x', p_amount, 'list', p_list, 'disc', v_disc,
                                  'late', v_late, 'waived_delta', 0, 'amount', p_amount, 'status', 'cancelled');
    END IF;

    RETURN jsonb_build_object('error', 'DATOS_INVALIDOS', 'detail', 'kind inválido');
END;
$function$;

REVOKE ALL ON FUNCTION public._ajuste_calcular(text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, boolean)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._ajuste_calcular(text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, boolean)
    TO service_role;

-- ── _apply_payment_adjustment (§7.5) ────────────────────────────────────────
-- Exige que el llamador ya tenga la fila con FOR UPDATE (la vuelve a pedir: es
-- reentrante dentro de la misma transacción). Cualquier violación = RAISE y la
-- operación entera revierte. Devuelve el efecto en pesos.
CREATE OR REPLACE FUNCTION public._apply_payment_adjustment(
    p_payment_id uuid, p_actor uuid, p_batch_id uuid,
    p_kind text, p_basis text, p_value numeric,
    p_scope text, p_context text, p_reason_code text, p_reason_text text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    r        public.payments;
    c        jsonb;
    v_is_mens boolean;
    v_seq    integer;
    v_x      numeric;
    v_status text;
    v_today  date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_text   text := NULLIF(btrim(COALESCE(p_reason_text, '')), '');
BEGIN
    SELECT * INTO r FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: cobro % no existe', p_payment_id USING ERRCODE = 'P0001';
    END IF;

    -- 1. Estado
    IF r.status = 'awaiting_approval' THEN
        RAISE EXCEPTION 'EN_REVISION: el cobro tiene un comprobante en revisión' USING ERRCODE = 'P0001';
    END IF;
    IF r.status NOT IN ('pending', 'overdue', 'partial', 'rejected', 'failed') THEN
        RAISE EXCEPTION 'COBRO_CERRADO: el cobro está %', r.status USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payment_installments i
                WHERE i.payment_id = r.id AND i.status = 'pending_review') THEN
        RAISE EXCEPTION 'EN_REVISION: el cobro tiene un abono en revisión' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Pasarela en vuelo: enlace firmado con monto y vigente.
    IF EXISTS (SELECT 1 FROM public.payment_links l
                WHERE l.payment_id = r.id AND l.status = 'pending' AND l.expires_at > now()) THEN
        RAISE EXCEPTION 'PAGO_EN_CURSO: la familia tiene un pago en curso' USING ERRCODE = 'P0001';
    END IF;

    -- Motivo
    IF p_reason_code IS NULL OR p_reason_code NOT IN ('pronto_pago','varios_meses','hermanos','beca','convenio',
            'cortesia','ajuste_de_precio','error_de_cobro','condonacion_mora','otro') THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: motivo %', p_reason_code USING ERRCODE = 'P0001';
    END IF;
    IF (p_reason_code = 'otro' OR p_kind = 'exoneracion')
       AND (v_text IS NULL OR length(v_text) < 3 OR length(v_text) > 300) THEN
        RAISE EXCEPTION 'MOTIVO_REQUERIDO: escribe el motivo (3 a 300 caracteres)' USING ERRCODE = 'P0001';
    END IF;

    v_is_mens := COALESCE(r.payment_category, 'mensualidad') = 'mensualidad';

    -- Defensa en profundidad: el actor administra la escuela; excedente solo owner.
    IF public._actor_rol_finanzas(r.school_id, p_actor) IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela' USING ERRCODE = '42501';
    END IF;
    IF r.payment_category = 'excedente'
       AND public._actor_rol_finanzas(r.school_id, p_actor) NOT IN ('owner', 'platform_admin') THEN
        RAISE EXCEPTION 'FORBIDDEN: solo el dueño de la escuela ajusta un cobro de horas de más' USING ERRCODE = '42501';
    END IF;

    -- Exonerar una mensualidad vencida: primero se condona todo el recargo
    -- (ajuste aparte, para que el informe de mora lo vea).
    IF p_kind = 'exoneracion' AND v_is_mens AND COALESCE(r.late_fee_amount, 0) > 0 THEN
        PERFORM public._apply_payment_adjustment(p_payment_id, p_actor, p_batch_id,
            'condonacion_recargo', 'valor', r.late_fee_amount, p_scope, p_context,
            'condonacion_mora', v_text);
        SELECT * INTO r FROM public.payments WHERE id = p_payment_id;
    END IF;

    c := public._ajuste_calcular(p_kind, p_basis, p_value, r.list_amount, r.discount_amount,
                                 r.late_fee_amount, r.amount, r.amount_paid,
                                 r.early_payment_discount_applied, v_is_mens);
    IF c->>'error' IS NOT NULL THEN
        RAISE EXCEPTION '%: %', c->>'error', COALESCE(c->>'detail', 'máximo $' || COALESCE(c->>'max', '0'))
            USING ERRCODE = 'P0001', DETAIL = c::text;
    END IF;

    v_x := (c->>'x')::numeric;
    v_status := COALESCE(c->>'status', r.status);
    -- 8. Descuento/condonación que cubre lo ya pagado → saldado.
    IF v_status = r.status AND COALESCE(r.amount_paid, 0) > 0
       AND COALESCE(r.amount_paid, 0) + COALESCE(r.early_payment_discount_applied, 0) >= (c->>'amount')::numeric THEN
        v_status := 'paid';
    END IF;

    SELECT COALESCE(max(a.sequence), 0) + 1 INTO v_seq
      FROM public.payment_adjustments a WHERE a.payment_id = r.id;

    IF p_kind = 'exoneracion' AND v_status = 'cancelled' THEN
        UPDATE public.payments
           SET status = 'cancelled',
               rejection_reason = 'Exonerado: ' || v_text,
               updated_at = now()
         WHERE id = r.id;
    ELSIF p_kind = 'exoneracion' THEN
        -- Mensualidad exonerada = beca del mes: 'paid' en $0 (§6.5).
        UPDATE public.payments
           SET amount            = 0,
               list_amount       = (c->>'list')::numeric,
               discount_amount   = (c->>'disc')::numeric,
               late_fee_amount   = 0,
               status            = 'paid',
               amount_paid       = 0,
               payment_method    = 'other',
               payment_channel   = 'exoneracion',
               payment_date      = v_today,
               approved_by       = p_actor,
               approved_at       = now(),
               requires_review   = false,
               updated_at        = now()
         WHERE id = r.id;
    ELSE
        UPDATE public.payments
           SET amount                 = (c->>'amount')::numeric,
               list_amount            = (c->>'list')::numeric,
               discount_amount        = (c->>'disc')::numeric,
               late_fee_amount        = (c->>'late')::numeric,
               late_fee_waived_amount = late_fee_waived_amount + (c->>'waived_delta')::numeric,
               status                 = v_status,
               updated_at             = now()
         WHERE id = r.id;
    END IF;

    INSERT INTO public.payment_adjustments (
        school_id, payment_id, charge_batch_id, kind, origin, applies_to, sequence,
        basis, pct, amount, scope, context, reason_code, reason_text,
        amount_before, amount_after, amount_paid_at, created_by)
    VALUES (
        r.school_id, r.id, p_batch_id, p_kind, 'modal', 'monto', v_seq,
        CASE WHEN p_kind = 'descuento' THEN p_basis
             WHEN p_basis = 'porcentaje' AND p_value IS NOT NULL THEN 'porcentaje'
             ELSE 'valor' END,
        CASE WHEN p_basis = 'porcentaje' AND p_value IS NOT NULL THEN p_value END,
        v_x, COALESCE(p_scope, 'linea'), p_context, p_reason_code, v_text,
        r.amount, (c->>'amount')::numeric, COALESCE(r.amount_paid, 0), p_actor);

    RETURN v_x;
END;
$function$;

REVOKE ALL ON FUNCTION public._apply_payment_adjustment(uuid, uuid, uuid, text, text, numeric, text, text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._apply_payment_adjustment(uuid, uuid, uuid, text, text, numeric, text, text, text, text)
    TO service_role;

-- ── _registrar_pago_en_cobro (§7.3 paso 9d) ─────────────────────────────────
-- p_payment: {method: cash|transfer, payment_date, reference?, receipt_url?,
--             receipt_sha256?, ocr_reference?, ocr?: {<columna ocr_* / receipt_*>: valor}}
-- p_principal: esta fila lleva hash y OCR del comprobante (Q23: una sola fila).
-- p_reference: referencia única de la fila (payments.reference es UNIQUE); el
--              número del comprobante va en receipt_number.
CREATE OR REPLACE FUNCTION public._registrar_pago_en_cobro(
    p_payment_id uuid, p_actor uuid, p_pay_amount numeric, p_payment jsonb,
    p_principal boolean, p_reference text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    r          public.payments;
    v_saldo    numeric;
    v_new_paid numeric;
    v_status   text;
    v_method   text := p_payment->>'method';
    v_date     date := NULLIF(p_payment->>'payment_date', '')::date;
    v_ocr      jsonb := COALESCE(p_payment->'ocr', '{}'::jsonb);
BEGIN
    SELECT * INTO r FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: cobro % no existe', p_payment_id USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(p_pay_amount, 0) <= 0 THEN
        RETURN r.status;
    END IF;
    IF r.status = 'awaiting_approval' THEN
        RAISE EXCEPTION 'EN_REVISION: el cobro tiene un comprobante en revisión' USING ERRCODE = 'P0001';
    END IF;
    IF r.status NOT IN ('pending', 'overdue', 'partial', 'rejected', 'failed') THEN
        RAISE EXCEPTION 'COBRO_CAMBIO: el cobro ya está %', r.status USING ERRCODE = 'P0001';
    END IF;
    IF v_method IS NULL OR v_method NOT IN ('cash', 'transfer') OR v_date IS NULL THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: método o fecha de pago' USING ERRCODE = 'P0001';
    END IF;

    v_saldo := r.amount - COALESCE(r.amount_paid, 0) - COALESCE(r.early_payment_discount_applied, 0);
    IF p_pay_amount > v_saldo THEN
        RAISE EXCEPTION 'SOBREPAGO: recibido % mayor que el saldo %', p_pay_amount, v_saldo USING ERRCODE = 'P0001';
    END IF;

    v_new_paid := COALESCE(r.amount_paid, 0) + p_pay_amount;
    v_status := CASE WHEN v_new_paid + COALESCE(r.early_payment_discount_applied, 0) >= r.amount
                     THEN 'paid' ELSE 'partial' END;

    UPDATE public.payments
       SET status          = v_status,
           amount_paid     = v_new_paid,
           payment_method  = v_method,
           payment_channel = v_method,
           payment_date    = v_date,
           approved_by     = p_actor,
           approved_at     = now(),
           reference       = COALESCE(reference, p_reference),
           receipt_number  = COALESCE(NULLIF(p_payment->>'reference', ''), receipt_number),
           receipt_url     = COALESCE(NULLIF(p_payment->>'receipt_url', ''), receipt_url),
           requires_review = false,
           unblocked_at    = CASE WHEN r.requires_review THEN now() ELSE unblocked_at END,
           unblocked_by    = CASE WHEN r.requires_review THEN p_actor ELSE unblocked_by END,
           -- Hash y OCR del comprobante solo en la fila principal (Q23).
           receipt_image_sha256        = CASE WHEN p_principal THEN COALESCE(NULLIF(p_payment->>'receipt_sha256', ''), v_ocr->>'receipt_image_sha256', receipt_image_sha256) ELSE receipt_image_sha256 END,
           receipt_image_sha256_source = CASE WHEN p_principal THEN COALESCE(v_ocr->>'receipt_image_sha256_source', receipt_image_sha256_source) ELSE receipt_image_sha256_source END,
           ocr_reference   = CASE WHEN p_principal THEN COALESCE(NULLIF(p_payment->>'ocr_reference', ''), v_ocr->>'ocr_reference', ocr_reference) ELSE ocr_reference END,
           ocr_amount      = CASE WHEN p_principal THEN COALESCE((v_ocr->>'ocr_amount')::numeric, ocr_amount) ELSE ocr_amount END,
           ocr_currency    = CASE WHEN p_principal THEN COALESCE(v_ocr->>'ocr_currency', ocr_currency) ELSE ocr_currency END,
           ocr_date        = CASE WHEN p_principal THEN COALESCE((v_ocr->>'ocr_date')::date, ocr_date) ELSE ocr_date END,
           ocr_bank        = CASE WHEN p_principal THEN COALESCE(v_ocr->>'ocr_bank', ocr_bank) ELSE ocr_bank END,
           ocr_provider    = CASE WHEN p_principal THEN COALESCE(v_ocr->>'ocr_provider', ocr_provider) ELSE ocr_provider END,
           ocr_destination = CASE WHEN p_principal THEN COALESCE(v_ocr->>'ocr_destination', ocr_destination) ELSE ocr_destination END,
           ocr_destination_name = CASE WHEN p_principal THEN COALESCE(v_ocr->>'ocr_destination_name', ocr_destination_name) ELSE ocr_destination_name END,
           ocr_origin_name = CASE WHEN p_principal THEN COALESCE(v_ocr->>'ocr_origin_name', ocr_origin_name) ELSE ocr_origin_name END,
           ocr_time        = CASE WHEN p_principal THEN COALESCE(v_ocr->>'ocr_time', ocr_time) ELSE ocr_time END,
           ocr_raw_response = CASE WHEN p_principal THEN COALESCE(v_ocr->'ocr_raw_response', ocr_raw_response) ELSE ocr_raw_response END,
           receipt_verdict = CASE WHEN p_principal THEN COALESCE(v_ocr->>'receipt_verdict', receipt_verdict) ELSE receipt_verdict END,
           receipt_verdict_reasons = CASE WHEN p_principal THEN COALESCE(v_ocr->'receipt_verdict_reasons', receipt_verdict_reasons) ELSE receipt_verdict_reasons END,
           receipt_reference_norm = CASE WHEN p_principal THEN COALESCE(v_ocr->>'receipt_reference_norm', receipt_reference_norm) ELSE receipt_reference_norm END,
           receipt_verdict_at = CASE WHEN p_principal AND v_ocr ? 'receipt_verdict' THEN now() ELSE receipt_verdict_at END,
           updated_at      = now()
     WHERE id = r.id;

    -- Un abono deja su rastro en el historial único de abonos (§7.3 9d). La tabla
    -- exige pagador o atleta con cuenta (installment_owner_check): un menor sin
    -- acudiente o un adulto sin cuenta queda solo con amount_paid.
    IF v_status = 'partial' AND (r.parent_id IS NOT NULL OR r.user_id IS NOT NULL) THEN
        INSERT INTO public.payment_installments (
            payment_id, school_id, parent_id, athlete_id, amount, receipt_url, receipt_date,
            notes, status, reviewed_by, reviewed_at, upload_channel)
        VALUES (
            r.id, r.school_id, r.parent_id, r.user_id, p_pay_amount,
            NULLIF(p_payment->>'receipt_url', ''), v_date,
            'Abono registrado por la escuela (Cobros y pagos)', 'approved', p_actor, now(), 'staff');
    END IF;

    RETURN v_status;
END;
$function$;

REVOKE ALL ON FUNCTION public._registrar_pago_en_cobro(uuid, uuid, numeric, jsonb, boolean, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._registrar_pago_en_cobro(uuid, uuid, numeric, jsonb, boolean, text)
    TO service_role;

-- ── _plan_aplicar_ajuste: un paso del planificador (puro) ───────────────────
-- p_item lleva el estado: list, disc, late, waived, amount, paid, epd, is_mens,
-- status, adjustments[], errors[]. Devuelve el ítem con el ajuste aplicado o con
-- el error agregado (no lanza).
CREATE OR REPLACE FUNCTION public._plan_aplicar_ajuste(
    p_item jsonb, p_kind text, p_basis text, p_value numeric, p_scope text,
    p_context text, p_reason_code text, p_reason_text text, p_extra jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    c        jsonb;
    v_amount numeric := (p_item->>'amount')::numeric;
    v_paid   numeric := COALESCE((p_item->>'paid')::numeric, 0);
    v_epd    numeric := COALESCE((p_item->>'epd')::numeric, 0);
    v_status text;
    v_adj    jsonb;
BEGIN
    c := public._ajuste_calcular(p_kind, p_basis, p_value,
                                 NULLIF(p_item->>'list', '')::numeric,
                                 COALESCE((p_item->>'disc')::numeric, 0),
                                 COALESCE((p_item->>'late')::numeric, 0),
                                 v_amount, v_paid, v_epd,
                                 COALESCE((p_item->>'is_mens')::boolean, false));
    IF c->>'error' IS NOT NULL THEN
        RETURN jsonb_set(p_item, '{errors}',
            COALESCE(p_item->'errors', '[]'::jsonb) || jsonb_build_object(
                'ref', p_item->>'ref', 'code', c->>'error', 'kind', p_kind,
                'detail', c->>'detail', 'max', c->'max'));
    END IF;

    v_status := COALESCE(c->>'status', p_item->>'status');
    IF c->>'status' IS NULL AND v_paid > 0 AND v_paid + v_epd >= (c->>'amount')::numeric THEN
        v_status := 'paid';
    END IF;

    v_adj := jsonb_build_object(
        'kind', p_kind,
        'origin', 'modal',
        'basis', CASE WHEN p_kind = 'descuento' THEN p_basis
                      WHEN p_basis = 'porcentaje' AND p_value IS NOT NULL THEN 'porcentaje'
                      ELSE 'valor' END,
        'pct', CASE WHEN p_basis = 'porcentaje' AND p_value IS NOT NULL THEN p_value END,
        'value', p_value,
        'amount', (c->>'x')::numeric,
        'scope', COALESCE(p_scope, 'linea'),
        'context', p_context,
        'reason_code', p_reason_code,
        'reason_text', NULLIF(btrim(COALESCE(p_reason_text, '')), ''),
        'amount_before', v_amount,
        'amount_after', (c->>'amount')::numeric) || COALESCE(p_extra, '{}'::jsonb);

    RETURN p_item || jsonb_build_object(
        'list', (c->>'list')::numeric,
        'disc', (c->>'disc')::numeric,
        'late', (c->>'late')::numeric,
        'waived', COALESCE((p_item->>'waived')::numeric, 0) + (c->>'waived_delta')::numeric,
        'amount', (c->>'amount')::numeric,
        'status', v_status,
        'adjustments', COALESCE(p_item->'adjustments', '[]'::jsonb) || v_adj);
END;
$function$;

REVOKE ALL ON FUNCTION public._plan_aplicar_ajuste(jsonb, text, text, numeric, text, text, text, text, jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._plan_aplicar_ajuste(jsonb, text, text, numeric, text, text, text, text, jsonb)
    TO service_role;

-- ── _plan_charge_operation: el cálculo compartido de preview y create ───────
-- No escribe. Lanza los errores estructurales (actor, escuela, topes, forma de
-- los datos, atleta ajeno) y devuelve los errores por línea en "errors".
CREATE OR REPLACE FUNCTION public._plan_charge_operation(
    p_school_id uuid,
    p_actor uuid,
    p_mode text,
    p_athletes jsonb,
    p_lines jsonb,
    p_overrides jsonb DEFAULT '[]'::jsonb,
    p_pending jsonb DEFAULT '[]'::jsonb,
    p_global_discount jsonb DEFAULT NULL,
    p_payment jsonb DEFAULT NULL,
    p_new_athlete jsonb DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
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
                    v_sib_on := COALESCE((v_l->>'auto_discounts')::boolean, true);
                    IF v_sib_on AND v_list IS NOT NULL AND NOT COALESCE(v_e.fee_is_manual, false)
                       AND v_child IS NOT NULL AND NULLIF(v_a->>'parent_id', '') IS NOT NULL THEN
                        SELECT NULLIF(ss.sibling_discount_percentage, 0) INTO v_sib_pct
                          FROM public.school_settings ss
                         WHERE ss.school_id = p_school_id AND ss.sibling_discount_enabled IS TRUE;
                        IF v_sib_pct IS NOT NULL AND EXISTS (
                            SELECT 1 FROM public.enrollments e2
                              JOIN public.children c2 ON c2.id = e2.child_id
                             WHERE c2.parent_id = (v_a->>'parent_id')::uuid
                               AND e2.school_id = p_school_id
                               AND e2.status = 'active'
                               AND e2.child_id <> v_child
                               AND (e2.created_at < v_e.created_at
                                    OR (e2.created_at = v_e.created_at AND e2.child_id < v_child))) THEN
                            v_sib := round((v_list - v_mil) * v_sib_pct / 100);
                        ELSE
                            v_sib_pct := NULL;
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

REVOKE ALL ON FUNCTION public._plan_charge_operation(uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._plan_charge_operation(uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
    TO service_role;

COMMIT;
