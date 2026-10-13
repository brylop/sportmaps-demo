-- =============================================================================
-- 20261010144600_cobros_f1_rpcs.sql
-- Autor: Brayan Steven Lopez   Fecha: 2026-10-10   Versión anterior: 20261010144559
-- Objetivo: F1 de «Cobros y pagos» (spec cobros-multiples §7.2–§7.5, §13, §12 M9).
--   RPC del modal (solo service_role; el BFF valida el rol y pasa p_actor; cada
--   RPC lo re-valida contra school_members / schools.owner_id / platform_admins
--   con public._actor_rol_finanzas, sin auth.uid()):
--     preview_charge_batch       vista previa (no escribe; mismo cálculo que create)
--     create_charge_batch        ÚNICA escritura del modal: crea cobros, aplica
--                                ajustes y registra pagos en UNA transacción (D6)
--     annul_charge_batch         anula lo anulable de un lote (Q12)
--     revert_payment_adjustment  «Quitar descuento» (§7.5)
--   Firmas finales (con los agregados respecto al spec) en
--   docs/specs/cobros-multiples.md § «Contrato final F1».
--
-- Radio (base viva, 2026-10-10, solo lectura): funciones nuevas (pg_proc: 0 con
--   esos nombres). Nadie las llama hasta F2 (BFF). No cambian ningún camino vivo.
--   Medición de tiempo de un lote de 600 filas en Campestre: PENDIENTE (bloque en
--   supabase/migrations/_smoke/charge_batches_smoke.sql, con ROLLBACK).
--
-- Seguridad: SECURITY DEFINER + search_path fijo (I4); REVOKE de PUBLIC, anon y
--   authenticated (los default privileges del esquema otorgan EXECUTE a
--   authenticated: trampa #3) y GRANT EXECUTE solo a service_role.
-- =============================================================================

BEGIN;

-- ── preview_charge_batch (§7.2) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_charge_batch(
    p_school_id uuid,
    p_actor uuid,
    p_athletes jsonb,
    p_lines jsonb,
    p_pending jsonb DEFAULT '[]'::jsonb,
    p_global_discount jsonb DEFAULT NULL,
    p_payment jsonb DEFAULT NULL,
    p_new_athlete jsonb DEFAULT NULL,
    p_overrides jsonb DEFAULT '[]'::jsonb,
    p_mode text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_mode text;
    v_plan jsonb;
    v_dups jsonb;
BEGIN
    IF p_new_athlete IS NOT NULL AND jsonb_array_length(COALESCE(p_athletes, '[]'::jsonb)) > 0 THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: new_athlete excluye athletes[]' USING ERRCODE = 'P0001';
    END IF;
    v_mode := COALESCE(p_mode,
                       CASE WHEN jsonb_array_length(COALESCE(p_athletes, '[]'::jsonb)) > 1
                            THEN 'multi' ELSE 'single' END);

    v_plan := public._plan_charge_operation(p_school_id, p_actor, v_mode, p_athletes, p_lines,
                                            p_overrides, p_pending, p_global_discount, p_payment,
                                            p_new_athlete);

    IF p_new_athlete IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_dups
          FROM public._find_athlete_duplicates(p_school_id, p_new_athlete->>'full_name',
                                               p_new_athlete->>'doc_number',
                                               p_new_athlete->>'guardian_phone') d;
        v_plan := v_plan || jsonb_build_object('duplicates', v_dups);
    END IF;

    RETURN v_plan;
END;
$function$;

REVOKE ALL ON FUNCTION public.preview_charge_batch(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_charge_batch(uuid, uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text)
    TO service_role;

-- ── create_charge_batch (§7.3, pasos 1–13 con 3b y 9a–9d) ───────────────────
CREATE OR REPLACE FUNCTION public.create_charge_batch(
    p_school_id uuid,
    p_actor uuid,
    p_client_request_id uuid,
    p_mode text,
    p_target jsonb,
    p_athletes jsonb,
    p_lines jsonb,
    p_overrides jsonb,
    p_notify boolean,
    p_preview_hash text,
    p_pending jsonb DEFAULT '[]'::jsonb,
    p_global_discount jsonb DEFAULT NULL,
    p_payment jsonb DEFAULT NULL,
    p_new_athlete jsonb DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_today     date := (now() AT TIME ZONE 'America/Bogota')::date;
    v_batch     public.charge_batches;
    v_batch_id  uuid;
    v_athletes  jsonb := COALESCE(p_athletes, '[]'::jsonb);
    v_plan      jsonb;
    v_items     jsonb := '[]'::jsonb;
    v_all       jsonb;
    v_it        jsonb;
    v_adj       jsonb;
    v_err       jsonb;
    v_aid       uuid;
    v_pid       uuid;
    v_dups      jsonb;
    v_new_ref   jsonb;
    v_kind      text;
    v_name      text;
    v_phone     text;
    v_seq       integer;
    v_before    numeric;
    v_res       jsonb;
    v_principal uuid;
    v_max_pay   numeric := 0;
    v_n_ref     integer := 0;
    v_row       record;
    v_school    text;
    v_payment_ids uuid[] := '{}';
BEGIN
    IF p_client_request_id IS NULL THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: client_request_id obligatorio' USING ERRCODE = 'P0001';
    END IF;

    -- 1. Idempotencia primero.
    SELECT * INTO v_batch FROM public.charge_batches
     WHERE school_id = p_school_id AND client_request_id = p_client_request_id;
    IF FOUND THEN
        RETURN jsonb_build_object('batch_id', v_batch.id, 'duplicated', true,
                                  'rows_created', v_batch.rows_created, 'total_amount', v_batch.total_amount);
    END IF;

    IF public._actor_rol_finanzas(p_school_id, p_actor) IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela (owner, admin o school_admin)' USING ERRCODE = '42501';
    END IF;

    -- 2. Doble clic simultáneo: el segundo espera aquí y encuentra el lote.
    PERFORM pg_advisory_xact_lock(hashtextextended(
        'charge_batch:' || p_school_id::text || ':' || p_client_request_id::text, 0));
    SELECT * INTO v_batch FROM public.charge_batches
     WHERE school_id = p_school_id AND client_request_id = p_client_request_id;
    IF FOUND THEN
        RETURN jsonb_build_object('batch_id', v_batch.id, 'duplicated', true,
                                  'rows_created', v_batch.rows_created, 'total_amount', v_batch.total_amount);
    END IF;

    -- 3b. Atleta nuevo (§16): búsqueda de duplicados bajo lock; todo o nada.
    IF p_new_athlete IS NOT NULL THEN
        IF p_mode <> 'single' OR jsonb_array_length(v_athletes) > 0 THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: new_athlete solo en modo un atleta y sin athletes[]' USING ERRCODE = 'P0001';
        END IF;
        v_kind  := p_new_athlete->>'kind';
        v_name  := btrim(COALESCE(p_new_athlete->>'full_name', ''));
        v_phone := btrim(COALESCE(p_new_athlete->>'guardian_phone', ''));
        IF v_kind NOT IN ('menor', 'adulto') OR length(v_name) < 3 OR length(v_name) > 120
           OR length(v_phone) < 7 OR length(v_phone) > 20 THEN
            RAISE EXCEPTION 'DATOS_INVALIDOS: atleta nuevo (kind menor|adulto, nombre 3–120, teléfono 7–20)' USING ERRCODE = 'P0001';
        END IF;
        IF public._actor_rol_finanzas(p_school_id, p_actor) IS NULL THEN
            RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela' USING ERRCODE = '42501';
        END IF;
        IF NOT COALESCE(public.school_is_operational(p_school_id), false) THEN
            RAISE EXCEPTION 'ESCUELA_NO_OPERATIVA: la escuela no está operativa' USING ERRCODE = 'P0001';
        END IF;

        PERFORM pg_advisory_xact_lock(hashtextextended(
            'athlete_new:' || p_school_id::text || ':' || COALESCE(public.normalize_athlete_name(v_name), ''), 0));

        SELECT jsonb_agg(to_jsonb(d)) INTO v_dups
          FROM public._find_athlete_duplicates(p_school_id, v_name, p_new_athlete->>'doc_number', v_phone) d
         WHERE d.matched_by && ARRAY['doc', 'nombre'];          -- solo teléfono = informativo

        IF v_dups IS NOT NULL AND NOT COALESCE((p_new_athlete->>'allow_duplicate')::boolean, false) THEN
            RAISE EXCEPTION 'ATLETA_DUPLICADO: ya existe % en esta escuela', v_dups->0->>'full_name'
                USING ERRCODE = 'P0001',
                      DETAIL = jsonb_build_object('code', 'ATLETA_DUPLICADO', 'matches', v_dups)::text,
                      HINT = 'Usa la ficha existente o confirma allow_duplicate.';
        END IF;
        IF v_dups IS NOT NULL THEN
            PERFORM set_config('app.permitir_atleta_duplicado', 'on', true);
        END IF;

        IF v_kind = 'menor' THEN
            INSERT INTO public.children (full_name, school_id, parent_name_temp, parent_phone_temp,
                                         doc_type, doc_number, date_of_birth, is_active)
            VALUES (v_name, p_school_id,
                    NULLIF(btrim(COALESCE(p_new_athlete->>'guardian_name', '')), ''),
                    v_phone,
                    NULLIF(btrim(COALESCE(p_new_athlete->>'doc_type', '')), ''),
                    NULLIF(btrim(COALESCE(p_new_athlete->>'doc_number', '')), ''),
                    NULLIF(p_new_athlete->>'date_of_birth', '')::date,
                    true)
            RETURNING id INTO v_aid;
            v_new_ref := jsonb_build_object('table', 'children', 'id', v_aid);
            v_athletes := jsonb_build_array(jsonb_build_object('type', 'child', 'id', v_aid, 'is_new', true));
        ELSE
            INSERT INTO public.unregistered_athletes (school_id, full_name, doc_type, doc_number, phone,
                                                      date_of_birth, intake_form_data)
            VALUES (p_school_id, v_name,
                    NULLIF(btrim(COALESCE(p_new_athlete->>'doc_type', '')), ''),
                    NULLIF(btrim(COALESCE(p_new_athlete->>'doc_number', '')), ''),
                    v_phone,
                    NULLIF(p_new_athlete->>'date_of_birth', '')::date,
                    jsonb_build_object('origen', 'cobros_y_pagos'))
            RETURNING id INTO v_aid;
            v_new_ref := jsonb_build_object('table', 'unregistered_athletes', 'id', v_aid);
            v_athletes := jsonb_build_array(jsonb_build_object('type', 'unregistered', 'id', v_aid, 'is_new', true));
        END IF;

        INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, new_data)
        VALUES (p_school_id, p_actor, v_new_ref->>'table', v_aid::text, 'athlete_created_from_cobros',
                jsonb_build_object('full_name', v_name, 'origen', 'cobros_y_pagos'));
        IF v_dups IS NOT NULL THEN
            INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, new_data)
            VALUES (p_school_id, p_actor, v_new_ref->>'table', v_aid::text, 'athlete_duplicate_forced',
                    jsonb_build_object('matches', v_dups));
        END IF;
    END IF;

    -- 4. Locks por atleta en orden estable (misma llave que el alta).
    FOR v_aid IN
        SELECT DISTINCT NULLIF(a->>'id', '')::uuid AS id
          FROM jsonb_array_elements(v_athletes) a
         WHERE NULLIF(a->>'id', '') IS NOT NULL
         ORDER BY 1
    LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended('enrollment_fees:' || v_aid::text, 0));
    END LOOP;

    -- 4b. Pendientes y excedentes bloqueados ANTES de planificar.
    PERFORM 1 FROM public.payments p
     WHERE p.school_id = p_school_id
       AND p.id IN (SELECT NULLIF(x->>'payment_id', '')::uuid
                      FROM jsonb_array_elements(COALESCE(p_pending, '[]'::jsonb)) x)
     ORDER BY p.id
       FOR UPDATE;
    PERFORM 1 FROM public.hour_bank_overage_charges o
     WHERE o.school_id = p_school_id
       AND o.id IN (SELECT NULLIF(x->>'overage_charge_id', '')::uuid
                      FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) x)
     ORDER BY o.id
       FOR UPDATE;

    -- 5–6. Mismo cálculo que la vista previa; si cambió algo, PREVIEW_STALE.
    v_plan := public._plan_charge_operation(p_school_id, p_actor, p_mode, v_athletes, p_lines,
                                            p_overrides, p_pending, p_global_discount, p_payment,
                                            p_new_athlete);
    IF p_preview_hash IS DISTINCT FROM v_plan->>'preview_hash' THEN
        RAISE EXCEPTION 'PREVIEW_STALE: la vista previa cambió; vuelve a pedirla'
            USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object('code', 'PREVIEW_STALE',
                                              'preview_hash', v_plan->>'preview_hash')::text;
    END IF;
    IF jsonb_array_length(v_plan->'errors') > 0 THEN
        v_err := v_plan->'errors'->0;
        RAISE EXCEPTION '%: %', v_err->>'code', COALESCE(v_err->>'detail', v_err->>'ref', '')
            USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object('code', v_err->>'code', 'errors', v_plan->'errors')::text;
    END IF;

    -- 7. Lote.
    INSERT INTO public.charge_batches (
        school_id, client_request_id, mode, target, lines, status, rows_created, rows_skipped,
        total_amount, skipped, notify_families, payments_registered, paid_total, discount_total,
        late_fee_waived_total, payment, created_by)
    VALUES (
        p_school_id, p_client_request_id, p_mode,
        COALESCE(p_target, jsonb_build_object('kind', 'athlete', 'ids', '[]'::jsonb)),
        COALESCE(p_lines, '[]'::jsonb), 'created',
        (v_plan#>>'{to_create,n}')::int,
        jsonb_array_length(v_plan->'skipped'),
        (v_plan#>>'{to_create,total}')::numeric,
        v_plan->'skipped',
        COALESCE(p_notify, false),
        (v_plan#>>'{to_pay,n}')::int,
        (v_plan#>>'{to_pay,total}')::numeric,
        (v_plan#>>'{discounts,total}')::numeric,
        (v_plan->>'late_fee_waived')::numeric,
        CASE WHEN p_mode = 'single' THEN p_payment END,
        p_actor)
    RETURNING id INTO v_batch_id;

    -- 8. Suprime la notificación por fila (fn_notify_on_payment_created).
    PERFORM set_config('app.charge_batch_id', v_batch_id::text, true);

    -- 9. Ids pre-generados para las filas nuevas.
    FOR v_it IN SELECT value FROM jsonb_array_elements(v_plan->'items') LOOP
        IF (v_it->>'will_create')::boolean THEN
            v_it := v_it || jsonb_build_object('payment_id', gen_random_uuid());
            v_payment_ids := v_payment_ids || (v_it->>'payment_id')::uuid;
        END IF;
        v_items := v_items || v_it;
    END LOOP;

    -- 9. Una sola sentencia para los cobros nuevos (salvo excedentes).
    --    El índice único de período es la última defensa: 23505 → todo revierte.
    INSERT INTO public.payments (
        id, school_id, branch_id, parent_id, child_id, user_id, unregistered_athlete_id,
        team_id, offering_plan_id, amount, concept, due_date, status, payment_type,
        payment_category, period_year, period_month, period_uniqueness_exempt,
        list_amount, discount_amount, sibling_discount_applied, created_by, notes, charge_batch_id)
    SELECT (x->>'payment_id')::uuid, p_school_id,
           NULLIF(x->>'branch_id', '')::uuid, NULLIF(x->>'parent_id', '')::uuid,
           NULLIF(x->>'child_id', '')::uuid, NULLIF(x->>'user_id', '')::uuid,
           NULLIF(x->>'unregistered_athlete_id', '')::uuid,
           NULLIF(x->>'team_id', '')::uuid, NULLIF(x->>'offering_plan_id', '')::uuid,
           (x->>'list')::numeric - COALESCE((x->>'auto_disc')::numeric, 0),
           x->>'concept', (x->>'due_date')::date, 'pending', x->>'payment_type',
           x->>'category', (x->>'period_year')::smallint, (x->>'period_month')::smallint,
           (x->>'period_uniqueness_exempt')::boolean,
           CASE WHEN COALESCE((x->>'auto_disc')::numeric, 0) > 0 THEN (x->>'list')::numeric END,
           COALESCE((x->>'auto_disc')::numeric, 0),
           NULLIF(x->>'sibling_discount_applied', '')::numeric,
           p_actor, x->>'notes', v_batch_id
      FROM jsonb_array_elements(v_items) x
     WHERE (x->>'will_create')::boolean
       AND x->>'category' <> 'excedente';

    -- 10. Excedentes: misma regla que confirm_hour_bank_overage.
    FOR v_it IN SELECT value FROM jsonb_array_elements(v_items)
                 WHERE (value->>'will_create')::boolean AND value->>'category' = 'excedente' LOOP
        v_res := public._confirm_overage_into_payment(
            (v_it->>'overage_charge_id')::uuid, p_actor, (v_it->>'list')::numeric,
            (v_it->>'due_date')::date, v_batch_id, (v_it->>'payment_id')::uuid, v_it->>'notes');
        IF v_res ? 'error' THEN
            RAISE EXCEPTION 'EXCEDENTE_NO_DISPONIBLE: %', v_res->>'error'
                USING ERRCODE = 'P0001', DETAIL = v_res::text;
        END IF;
    END LOOP;

    -- Ajustes automáticos de las filas nuevas (militar, hermanos), en orden.
    FOR v_it IN SELECT value FROM jsonb_array_elements(v_items) WHERE (value->>'will_create')::boolean LOOP
        v_seq := 0;
        FOR v_adj IN SELECT value FROM jsonb_array_elements(v_it->'adjustments')
                      WHERE value->>'origin' IN ('militar', 'hermanos') LOOP
            v_seq := v_seq + 1;
            INSERT INTO public.payment_adjustments (
                school_id, payment_id, charge_batch_id, kind, origin, applies_to, sequence,
                basis, pct, amount, scope, context, reason_code, reason_text,
                amount_before, amount_after, amount_paid_at, created_by)
            VALUES (
                p_school_id, (v_it->>'payment_id')::uuid, v_batch_id, 'descuento', v_adj->>'origin', 'monto',
                v_seq, v_adj->>'basis', NULLIF(v_adj->>'pct', '')::numeric, (v_adj->>'amount')::numeric,
                'linea', 'al_crear', v_adj->>'reason_code', v_adj->>'reason_text',
                (v_adj->>'amount_before')::numeric, (v_adj->>'amount_after')::numeric, 0, p_actor);
        END LOOP;
    END LOOP;

    -- 9a–9c. Ajustes del modal (por línea, general, cierre, exoneración), en el
    --        orden exacto del plan. Cada ítem es independiente de los demás.
    v_all := (SELECT COALESCE(jsonb_agg(value), '[]'::jsonb) FROM jsonb_array_elements(v_items)
               WHERE (value->>'will_create')::boolean)
             || COALESCE(v_plan->'pending', '[]'::jsonb);
    FOR v_it IN SELECT value FROM jsonb_array_elements(v_all) LOOP
        v_pid := (v_it->>'payment_id')::uuid;
        FOR v_adj IN SELECT value FROM jsonb_array_elements(v_it->'adjustments')
                      WHERE value->>'origin' = 'modal' LOOP
            PERFORM public._apply_payment_adjustment(
                v_pid, p_actor, v_batch_id, v_adj->>'kind', v_adj->>'basis',
                CASE WHEN v_adj->>'kind' = 'exoneracion' THEN NULL
                     WHEN v_adj->>'basis' = 'porcentaje' THEN (v_adj->>'pct')::numeric
                     ELSE (v_adj->>'amount')::numeric END,
                v_adj->>'scope', v_adj->>'context', v_adj->>'reason_code', v_adj->>'reason_text');
        END LOOP;
        IF COALESCE((v_it->>'pay_amount')::numeric, 0) > v_max_pay THEN
            v_max_pay := (v_it->>'pay_amount')::numeric;
            v_principal := v_pid;
        END IF;
    END LOOP;

    -- 9d. Registro del pago (solo modo un atleta). Hash/OCR en una sola fila.
    IF p_payment IS NOT NULL THEN
        FOR v_it IN SELECT value FROM jsonb_array_elements(v_all)
                     WHERE COALESCE((value->>'pay_amount')::numeric, 0) > 0
                     ORDER BY value->>'payment_id' LOOP
            v_n_ref := v_n_ref + 1;
            PERFORM public._registrar_pago_en_cobro(
                (v_it->>'payment_id')::uuid, p_actor, (v_it->>'pay_amount')::numeric, p_payment,
                (v_it->>'payment_id')::uuid = v_principal,
                'CYP-' || left(replace(v_batch_id::text, '-', ''), 12) || '-' || v_n_ref);
        END LOOP;
    END IF;

    -- Verificación: lo escrito es exactamente lo planificado.
    FOR v_it IN SELECT value FROM jsonb_array_elements(v_all) LOOP
        SELECT p.amount, p.status, COALESCE(p.amount_paid, 0) AS paid INTO v_row
          FROM public.payments p WHERE p.id = (v_it->>'payment_id')::uuid;
        IF v_row.amount IS DISTINCT FROM (v_it->>'amount')::numeric
           OR v_row.status IS DISTINCT FROM v_it->>'status'
           OR v_row.paid IS DISTINCT FROM COALESCE((v_it->>'paid')::numeric, 0) THEN
            RAISE EXCEPTION 'PLAN_DIVERGE: el cobro % quedó en % / % / pagado %, el plan decía % / % / %',
                v_it->>'payment_id', v_row.amount, v_row.status, v_row.paid,
                v_it->>'amount', v_it->>'status', COALESCE(v_it->>'paid', '0')
                USING ERRCODE = 'P0001';
        END IF;
    END LOOP;

    -- 11. Avisos agrupados por familia con cuenta.
    SELECT s.name INTO v_school FROM public.schools s WHERE s.id = p_school_id;
    -- (a) Cobros nuevos que quedaron por pagar: in-app, SIN push (Q9).
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link, category, data, push)
    SELECT g.payer, p_school_id,
           'Nuevos cobros de ' || COALESCE(v_school, 'tu escuela'),
           'Se generaron ' || g.n || CASE WHEN g.n = 1 THEN ' cobro' ELSE ' cobros' END
             || ' por $' || to_char(g.total, 'FM999,999,999') || '. Vence el '
             || to_char(g.due, 'DD/MM/YYYY') || '.',
           'info', '/my-payments', 'payment',
           jsonb_build_object('charge_batch_id', v_batch_id), false
      FROM (SELECT COALESCE(p.parent_id, p.user_id) AS payer, count(*) AS n,
                   sum(p.amount) AS total, min(p.due_date) AS due
              FROM public.payments p
             WHERE p.charge_batch_id = v_batch_id
               AND p.status = 'pending'
               AND COALESCE(p.parent_id, p.user_id) IS NOT NULL
             GROUP BY 1) g;
    -- (b) Pagos registrados: confirmación de plata (con push).
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link, category, data)
    SELECT g.payer, p_school_id, 'Pago registrado',
           COALESCE(v_school, 'Tu escuela') || ' registró tu pago por $'
             || to_char(g.total, 'FM999,999,999') || '. ¡Gracias!',
           'success', '/my-payments', 'payment',
           jsonb_build_object('charge_batch_id', v_batch_id)
      FROM (SELECT COALESCE(NULLIF(x->>'parent_id', '')::uuid, NULLIF(x->>'user_id', '')::uuid) AS payer,
                   sum((x->>'pay_amount')::numeric) AS total
              FROM jsonb_array_elements(v_all) x
             WHERE COALESCE((x->>'pay_amount')::numeric, 0) > 0
             GROUP BY 1) g
     WHERE g.payer IS NOT NULL;
    -- (c) Pendientes ajustados sin pago (Q-D9): in-app, sin push.
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link, category, data, push)
    SELECT g.payer, p_school_id, 'Tu cobro cambió',
           CASE WHEN g.n = 1 THEN 'Tu cobro «' || g.concept || '» ahora es $' || to_char(g.total, 'FM999,999,999') || '.'
                ELSE g.n || ' cobros cambiaron de valor. Revisa «Mis pagos».' END,
           'info', '/my-payments', 'payment',
           jsonb_build_object('charge_batch_id', v_batch_id), false
      FROM (SELECT COALESCE(NULLIF(x->>'parent_id', '')::uuid, NULLIF(x->>'user_id', '')::uuid) AS payer,
                   count(*) AS n, sum((x->>'amount')::numeric) AS total, min(x->>'concept') AS concept
              FROM jsonb_array_elements(COALESCE(v_plan->'pending', '[]'::jsonb)) x
             WHERE jsonb_array_length(x->'adjustments') > 0
               AND COALESCE((x->>'pay_amount')::numeric, 0) = 0
             GROUP BY 1) g
     WHERE g.payer IS NOT NULL;
    -- p_notify (aviso externo agrupado por correo/WhatsApp) llega en F5: queda
    -- marcado en charge_batches.notify_families.

    -- 12. Auditoría.
    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, new_data)
    VALUES (p_school_id, p_actor, 'charge_batches', v_batch_id::text, 'charge_batch_created',
            jsonb_build_object(
                'rows', v_plan#>'{to_create,n}', 'total', v_plan#>'{to_create,total}',
                'by_category', v_plan->'by_category', 'skipped', v_plan->'skipped',
                'payments_registered', v_plan#>'{to_pay,n}', 'paid_total', v_plan#>'{to_pay,total}',
                'discount_total', v_plan#>'{discounts,total}',
                'late_fee_waived_total', v_plan->'late_fee_waived',
                'new_athlete', v_new_ref));

    -- 13. Respuesta.
    RETURN jsonb_build_object(
        'batch_id', v_batch_id,
        'duplicated', false,
        'rows_created', (v_plan#>>'{to_create,n}')::int,
        'total_amount', (v_plan#>>'{to_create,total}')::numeric,
        'payment_ids', to_jsonb(v_payment_ids),
        'paid_ids', (SELECT COALESCE(jsonb_agg(x->'payment_id'), '[]'::jsonb)
                       FROM jsonb_array_elements(v_all) x WHERE x->>'status' = 'paid'),
        'partial_ids', (SELECT COALESCE(jsonb_agg(x->'payment_id'), '[]'::jsonb)
                          FROM jsonb_array_elements(v_all) x WHERE x->>'status' = 'partial'),
        'adjustments', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                            'id', a.id, 'payment_id', a.payment_id, 'kind', a.kind, 'origin', a.origin,
                            'sequence', a.sequence, 'basis', a.basis, 'pct', a.pct, 'amount', a.amount,
                            'scope', a.scope, 'reason_code', a.reason_code) ORDER BY a.payment_id, a.sequence),
                            '[]'::jsonb)
                          FROM public.payment_adjustments a WHERE a.charge_batch_id = v_batch_id),
        'skipped', v_plan->'skipped',
        'payments_registered', (v_plan#>>'{to_pay,n}')::int,
        'paid_total', (v_plan#>>'{to_pay,total}')::numeric,
        'new_athlete', v_new_ref);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_charge_batch(uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, boolean, text, jsonb, jsonb, jsonb, jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_charge_batch(uuid, uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, boolean, text, jsonb, jsonb, jsonb, jsonb)
    TO service_role;

-- ── annul_charge_batch (§7.4) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.annul_charge_batch(
    p_school_id uuid, p_actor uuid, p_batch_id uuid, p_reason text, p_expected_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    v_batch   public.charge_batches;
    v_reason  text := btrim(COALESCE(p_reason, ''));
    v_ids     uuid[];
    v_kept    jsonb;
BEGIN
    IF public._actor_rol_finanzas(p_school_id, p_actor) IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela' USING ERRCODE = '42501';
    END IF;
    IF length(v_reason) < 3 OR length(v_reason) > 300 THEN
        RAISE EXCEPTION 'MOTIVO_REQUERIDO: el motivo de anulación tiene 3 a 300 caracteres' USING ERRCODE = 'P0001';
    END IF;
    IF p_expected_count IS NULL OR p_expected_count < 0 THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: expected_count obligatorio' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_batch FROM public.charge_batches
     WHERE id = p_batch_id AND school_id = p_school_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: lote % no existe en esta escuela', p_batch_id USING ERRCODE = 'P0001';
    END IF;
    IF v_batch.status = 'annulled' THEN
        RAISE EXCEPTION 'COBRO_CERRADO: el lote ya está anulado' USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1 FROM public.payments p WHERE p.charge_batch_id = p_batch_id ORDER BY p.id FOR UPDATE;

    -- Anulable: sin plata recibida ni comprobante en revisión ni factura.
    SELECT COALESCE(array_agg(p.id ORDER BY p.id), '{}') INTO v_ids
      FROM public.payments p
     WHERE p.charge_batch_id = p_batch_id
       AND p.status IN ('pending', 'overdue', 'rejected', 'failed')
       AND COALESCE(p.amount_paid, 0) = 0
       AND NOT EXISTS (SELECT 1 FROM public.payment_installments i
                        WHERE i.payment_id = p.id AND i.status = 'pending_review');

    IF COALESCE(array_length(v_ids, 1), 0) <> p_expected_count THEN
        RAISE EXCEPTION 'ANNUL_STALE: hay % cobros anulables, la pantalla mostró %',
            COALESCE(array_length(v_ids, 1), 0), p_expected_count
            USING ERRCODE = 'P0001',
                  DETAIL = jsonb_build_object('code', 'ANNUL_STALE',
                                              'annullable', COALESCE(array_length(v_ids, 1), 0))::text;
    END IF;

    UPDATE public.payments
       SET status = 'cancelled',
           rejection_reason = 'Lote anulado: ' || v_reason,
           updated_at = now()
     WHERE id = ANY (v_ids);

    -- Excedentes ligados: vuelven a poder facturarse.
    UPDATE public.hour_bank_overage_charges
       SET status = 'suggested', payment_id = NULL, decided_by = NULL, decided_at = NULL,
           updated_at = now()
     WHERE payment_id = ANY (v_ids);

    SELECT COALESCE(jsonb_agg(jsonb_build_object('payment_id', p.id, 'status', p.status) ORDER BY p.id), '[]'::jsonb)
      INTO v_kept
      FROM public.payments p
     WHERE p.charge_batch_id = p_batch_id AND p.status <> 'cancelled';

    UPDATE public.charge_batches
       SET status = CASE WHEN jsonb_array_length(v_kept) = 0 THEN 'annulled' ELSE 'partially_annulled' END,
           annulled_by = p_actor, annulled_at = now(), annul_reason = v_reason
     WHERE id = p_batch_id;

    -- Aviso agrupado por familia afectada, sin push.
    INSERT INTO public.notifications (user_id, school_id, title, message, type, link, category, data, push)
    SELECT g.payer, p_school_id, 'Cobros anulados',
           'La escuela anuló ' || g.n || CASE WHEN g.n = 1 THEN ' cobro.' ELSE ' cobros.' END,
           'info', '/my-payments', 'payment', jsonb_build_object('charge_batch_id', p_batch_id), false
      FROM (SELECT COALESCE(p.parent_id, p.user_id) AS payer, count(*) AS n
              FROM public.payments p
             WHERE p.id = ANY (v_ids) AND COALESCE(p.parent_id, p.user_id) IS NOT NULL
             GROUP BY 1) g;

    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, new_data)
    VALUES (p_school_id, p_actor, 'charge_batches', p_batch_id::text, 'charge_batch_annulled',
            jsonb_build_object('annulled', to_jsonb(v_ids), 'kept', v_kept, 'reason', v_reason));

    RETURN jsonb_build_object('annulled', COALESCE(array_length(v_ids, 1), 0),
                              'annulled_ids', to_jsonb(v_ids), 'kept', v_kept);
END;
$function$;

REVOKE ALL ON FUNCTION public.annul_charge_batch(uuid, uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.annul_charge_batch(uuid, uuid, uuid, text, integer) TO service_role;

-- ── revert_payment_adjustment (§7.5 «Quitar descuento») ──────────────────────
CREATE OR REPLACE FUNCTION public.revert_payment_adjustment(
    p_school_id uuid, p_actor uuid, p_adjustment_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
    a        public.payment_adjustments;
    r        public.payments;
    v_role   text;
    v_reason text := btrim(COALESCE(p_reason, ''));
    v_new    numeric;
    v_status text;
    v_seq    integer;
    v_rev    uuid;
BEGIN
    v_role := public._actor_rol_finanzas(p_school_id, p_actor);
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN: el usuario no administra esta escuela' USING ERRCODE = '42501';
    END IF;
    IF length(v_reason) < 3 OR length(v_reason) > 300 THEN
        RAISE EXCEPTION 'MOTIVO_REQUERIDO: el motivo tiene 3 a 300 caracteres' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO a FROM public.payment_adjustments
     WHERE id = p_adjustment_id AND school_id = p_school_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'DATOS_INVALIDOS: ajuste % no existe en esta escuela', p_adjustment_id USING ERRCODE = 'P0001';
    END IF;
    IF a.kind = 'reversion' OR a.origin <> 'modal' OR a.applies_to <> 'monto' THEN
        -- Los automáticos (militar, hermanos, alta, pronto pago) son tarifa o
        -- pasarela: se cambian en su origen, no aquí.
        RAISE EXCEPTION 'AJUSTE_NO_REVERSIBLE: solo se quitan ajustes hechos en «Cobros y pagos»' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO r FROM public.payments WHERE id = a.payment_id FOR UPDATE;

    -- Con el cobro bloqueado: un ajuste se revierte una sola vez.
    IF EXISTS (SELECT 1 FROM public.payment_adjustments x WHERE x.reverts_id = a.id) THEN
        RAISE EXCEPTION 'YA_REVERTIDO: este ajuste ya se quitó' USING ERRCODE = 'P0001';
    END IF;
    IF r.payment_category = 'excedente' AND v_role NOT IN ('owner', 'platform_admin') THEN
        RAISE EXCEPTION 'FORBIDDEN: solo el dueño ajusta un cobro de horas de más' USING ERRCODE = '42501';
    END IF;
    IF r.status = 'awaiting_approval'
       OR EXISTS (SELECT 1 FROM public.payment_installments i
                   WHERE i.payment_id = r.id AND i.status = 'pending_review') THEN
        RAISE EXCEPTION 'EN_REVISION: el cobro tiene un comprobante en revisión' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.payment_links l
                WHERE l.payment_id = r.id AND l.status = 'pending' AND l.expires_at > now()) THEN
        RAISE EXCEPTION 'PAGO_EN_CURSO: la familia tiene un pago en curso' USING ERRCODE = 'P0001';
    END IF;

    SELECT COALESCE(max(x.sequence), 0) + 1 INTO v_seq
      FROM public.payment_adjustments x WHERE x.payment_id = r.id;
    v_new := r.amount + a.amount;

    IF a.kind = 'exoneracion' THEN
        IF r.status = 'cancelled' THEN
            RAISE EXCEPTION 'AJUSTE_NO_REVERSIBLE: un cobro único exonerado se anuló; crea uno nuevo' USING ERRCODE = 'P0001';
        END IF;
        IF NOT (r.status = 'paid' AND r.payment_channel = 'exoneracion' AND COALESCE(r.amount_paid, 0) = 0) THEN
            RAISE EXCEPTION 'COBRO_CERRADO: el cobro ya no es una beca sin pagos' USING ERRCODE = 'P0001';
        END IF;
        v_status := 'pending';
        UPDATE public.payments
           SET amount          = v_new,
               discount_amount = discount_amount - a.amount,
               status          = 'pending',
               amount_paid     = NULL,
               payment_method  = NULL,
               payment_channel = 'manual',
               payment_date    = NULL,
               approved_by     = NULL,
               approved_at     = NULL,
               updated_at      = now()
         WHERE id = r.id;
    ELSE
        IF r.status NOT IN ('pending', 'overdue', 'partial', 'rejected', 'failed') THEN
            RAISE EXCEPTION 'COBRO_CERRADO: el cobro está %; un cobro pagado es definitivo', r.status USING ERRCODE = 'P0001';
        END IF;
        v_status := r.status;
        IF a.kind = 'descuento' THEN
            UPDATE public.payments
               SET amount = v_new, discount_amount = discount_amount - a.amount, updated_at = now()
             WHERE id = r.id;
        ELSE  -- condonacion_recargo
            UPDATE public.payments
               SET amount = v_new,
                   late_fee_amount = late_fee_amount + a.amount,
                   late_fee_waived_amount = late_fee_waived_amount - a.amount,
                   updated_at = now()
             WHERE id = r.id;
        END IF;
    END IF;

    INSERT INTO public.payment_adjustments (
        school_id, payment_id, charge_batch_id, kind, origin, applies_to, sequence,
        basis, pct, amount, scope, context, reason_code, reason_text,
        amount_before, amount_after, amount_paid_at, reverts_id, created_by)
    VALUES (
        r.school_id, r.id, NULL, 'reversion', a.origin, a.applies_to, v_seq,
        NULL, NULL, a.amount, a.scope, 'sobre_pendiente', a.reason_code, v_reason,
        r.amount, v_new, COALESCE(r.amount_paid, 0), a.id, p_actor)
    RETURNING id INTO v_rev;

    INSERT INTO public.audit_logs (school_id, profile_id, table_name, record_id, action, old_data, new_data)
    VALUES (p_school_id, p_actor, 'payment_adjustments', a.id::text, 'payment_adjustment_reverted',
            jsonb_build_object('amount', r.amount, 'status', r.status),
            jsonb_build_object('amount', v_new, 'status', v_status, 'reversion_id', v_rev, 'reason', v_reason));

    RETURN jsonb_build_object('payment_id', r.id, 'reverted_id', a.id, 'reversion_id', v_rev,
                              'amount_before', r.amount, 'amount_after', v_new, 'status', v_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.revert_payment_adjustment(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revert_payment_adjustment(uuid, uuid, uuid, text) TO service_role;

COMMIT;
