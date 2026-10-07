-- ============================================================
-- SMOKE TEST — Ventas por WhatsApp, F0 carril B (20261007095911).
-- NO es una migración. Correr con psql tras aplicar la migración:
--   psql "$DATABASE_URL" \
--     -v school_id="'<uuid escuela de PRUEBA, operativa>'" \
--     -v child_id="'<children.id activo de esa escuela>'" \
--     -v parent_id="'<parent_id de ese child>'" \
--     -f supabase/migrations/_smoke/ventas_wa_f0_smoke.sql
--
-- Todo corre en una transacción con ROLLBACK final: no persiste nada (ni los
-- interruptores de la escuela, ni los ítems, ni los cobros de prueba).
-- Usar una escuela de prueba (Club Campestre Demo), nunca una real: el
-- trigger trg_notify_on_payment_created inserta notificaciones dentro de la
-- transacción (también se deshacen con el ROLLBACK).
-- Lo que NO cubre: concurrencia real entre dos sesiones (último cupo con dos
-- familias a la vez). Eso va en la prueba de concurrencia de F2.
-- ============================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _p (school_id uuid, child_id uuid, parent_id uuid,
                      item_a uuid, item_b uuid, item_c uuid, pay_a uuid);
INSERT INTO _p (school_id, child_id, parent_id) VALUES (:school_id, :child_id, :parent_id);

INSERT INTO public.school_settings (school_id) SELECT school_id FROM _p
ON CONFLICT (school_id) DO NOTHING;

-- ── 0. Permisos: anon/authenticated sin EXECUTE; service_role con ──────────
DO $$
DECLARE
  f text;
  fns text[] := ARRAY[
    'public.wa_catalogo_servicios(uuid,text,integer)',
    'public.wa_crear_cobro_suelto(uuid,uuid,uuid,uuid,text,uuid,integer)',
    'public.wa_anular_cobros_sueltos_vencidos(integer,integer)'];
BEGIN
  FOREACH f IN ARRAY fns LOOP
    IF has_function_privilege('anon', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL grants: anon puede ejecutar %', f;
    END IF;
    IF has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL grants: authenticated puede ejecutar %', f;
    END IF;
    IF NOT has_function_privilege('service_role', f, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL grants: service_role NO puede ejecutar %', f;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = f::regprocedure
                     AND prosecdef
                     AND proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']) THEN
      RAISE EXCEPTION 'FAIL %: sin SECURITY DEFINER o sin search_path fijo (I4)', f;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated', 'public.wa_cobros_sueltos', 'SELECT')
     OR has_table_privilege('authenticated', 'public.wa_cobros_sueltos', 'INSERT')
     OR has_table_privilege('anon', 'public.wa_cobros_sueltos', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL grants: wa_cobros_sueltos abierta a anon/authenticated';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.wa_cobros_sueltos'::regclass) THEN
    RAISE EXCEPTION 'FAIL: wa_cobros_sueltos sin RLS';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wa_cobros_sueltos') THEN
    RAISE EXCEPTION 'FAIL: wa_cobros_sueltos tiene policies (debe ser solo service role)';
  END IF;
  RAISE NOTICE 'OK 0 permisos ✓';
END $$;

-- La prueba definitiva de la tabla cerrada: como authenticated, ni leer.
SAVEPOINT s_auth;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM 1 FROM public.wa_cobros_sueltos LIMIT 1;
  RAISE EXCEPTION 'FAIL: authenticated leyó wa_cobros_sueltos';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK 0b authenticated sin acceso a wa_cobros_sueltos ✓';
END $$;
DO $$
BEGIN
  PERFORM public.wa_crear_cobro_suelto(NULL, NULL, NULL, NULL, 'x', NULL, 60);
  RAISE EXCEPTION 'FAIL: authenticated ejecutó wa_crear_cobro_suelto';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK 0c authenticated sin EXECUTE ✓';
END $$;
ROLLBACK TO SAVEPOINT s_auth;
RESET ROLE;

-- ── 1. Defaults y CHECK nuevos ──────────────────────────────────────────────
DO $$
DECLARE v_school uuid; v_hab boolean; v_id uuid; v_kind text; v_per boolean;
BEGIN
  SELECT school_id INTO v_school FROM _p;
  IF NOT public.school_is_operational(v_school) THEN
    RAISE EXCEPTION 'SETUP: la escuela de prueba no está operativa (school_is_operational=false)';
  END IF;
  SELECT wa_ventas_habilitadas INTO v_hab FROM public.school_settings WHERE school_id = v_school;
  IF v_hab IS NULL THEN RAISE EXCEPTION 'FAIL 1: wa_ventas_habilitadas no existe o es NULL'; END IF;

  INSERT INTO public.school_tournament_items (school_id, name, price)
  VALUES (v_school, 'Smoke torneo viejo', 1000) RETURNING id, kind, per_athlete INTO v_id, v_kind, v_per;
  IF v_kind <> 'torneo' OR v_per IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL 1 defaults: kind=% per_athlete=%', v_kind, v_per;
  END IF;

  BEGIN
    INSERT INTO public.school_tournament_items (school_id, name, price, kind) VALUES (v_school, 'x', 1, 'rifa');
    RAISE EXCEPTION 'FAIL 1: kind rifa aceptado';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.school_tournament_items (school_id, name, price, capacity) VALUES (v_school, 'x', 1, 0);
    RAISE EXCEPTION 'FAIL 1: capacity 0 aceptado';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.school_tournament_items (school_id, name, price, image_url) VALUES (v_school, 'x', 1, 'http://a.co/x.jpg');
    RAISE EXCEPTION 'FAIL 1: image_url http aceptado';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.school_tournament_items (school_id, name, price, starts_at, ends_at)
    VALUES (v_school, 'x', 1, now(), now() - interval '1 day');
    RAISE EXCEPTION 'FAIL 1: ends_at < starts_at aceptado';
  EXCEPTION WHEN check_violation THEN NULL; END;

  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'payments_payment_category_check'))
       NOT LIKE '%clase_extra%vacacional%viaje%' THEN
    RAISE EXCEPTION 'FAIL 1: payment_category sin clase_extra/vacacional/viaje';
  END IF;
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'whatsapp_conversation_flows_flow_check'))
       NOT LIKE '%venta%'
     OR pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'whatsapp_conversation_flows_step_check'))
       NOT LIKE '%venta_esperando_pago%' THEN
    RAISE EXCEPTION 'FAIL 1: whatsapp_conversation_flows no acepta el flujo venta';
  END IF;
  RAISE NOTICE 'OK 1 defaults y CHECK ✓';
END $$;

-- ── 2. Interruptores apagados ───────────────────────────────────────────────
-- tournament_charges_enabled lo protege un trigger (solo super admin); dentro
-- de esta transacción de prueba se apaga el guard para poder prenderlo.
ALTER TABLE public.school_settings DISABLE TRIGGER trg_guard_tournament_charges_enabled;
UPDATE public.school_settings SET wa_ventas_habilitadas = false, tournament_charges_enabled = true
WHERE school_id = (SELECT school_id FROM _p);

DO $$
DECLARE v_school uuid; v_parent uuid; v_child uuid; v_item uuid; r jsonb;
BEGIN
  SELECT school_id, parent_id, child_id INTO v_school, v_parent, v_child FROM _p;
  INSERT INTO public.school_tournament_items (school_id, name, description, price, kind, capacity, starts_at)
  VALUES (v_school, 'Clase de perfeccionamiento', 'Técnica individual', 25000, 'clase_extra', 1, now() + interval '1 day')
  RETURNING id INTO v_item;
  UPDATE _p SET item_a = v_item;

  r := public.wa_catalogo_servicios(v_school, NULL, 10);
  IF (r->>'habilitado')::boolean OR jsonb_array_length(r->'items') <> 0 THEN
    RAISE EXCEPTION 'FAIL 2 catálogo con wa_ventas_habilitadas=false: %', r;
  END IF;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0001', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'ventas_deshabilitadas' THEN
    RAISE EXCEPTION 'FAIL 2 cobro con interruptor apagado: %', r;
  END IF;
  RAISE NOTICE 'OK 2 interruptor apagado ✓';
END $$;

UPDATE public.school_settings SET wa_ventas_habilitadas = true, tournament_charges_enabled = true
WHERE school_id = (SELECT school_id FROM _p);
ALTER TABLE public.school_settings ENABLE TRIGGER trg_guard_tournament_charges_enabled;

-- ── 3. Catálogo ─────────────────────────────────────────────────────────────
DO $$
DECLARE v_school uuid; v_item uuid; r jsonb; it jsonb;
BEGIN
  SELECT school_id, item_a INTO v_school, v_item FROM _p;
  r := public.wa_catalogo_servicios(v_school, 'la clase de PERFECCIONAMIENTO de mañana', 10);
  IF NOT (r->>'habilitado')::boolean THEN RAISE EXCEPTION 'FAIL 3: catálogo no habilitado: %', r; END IF;
  SELECT x INTO it FROM jsonb_array_elements(r->'items') x WHERE x->>'id' = v_item::text;
  IF it IS NULL THEN RAISE EXCEPTION 'FAIL 3: la búsqueda no encontró el ítem: %', r; END IF;
  IF (it->>'precio')::numeric <> 25000 OR (it->>'cupos_restantes')::int <> 1
     OR it->>'tipo' <> 'clase_extra' OR (it->>'por_atleta')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL 3: ítem mal armado: %', it;
  END IF;
  r := public.wa_catalogo_servicios(v_school, 'zzzzqqqq', 10);
  IF jsonb_array_length(r->'items') <> 0 THEN RAISE EXCEPTION 'FAIL 3: búsqueda sin coincidencias devolvió ítems'; END IF;
  RAISE NOTICE 'OK 3 catálogo ✓';
END $$;

-- ── 4. Validaciones de familia y atleta ─────────────────────────────────────
DO $$
DECLARE v_school uuid; v_parent uuid; v_child uuid; v_item uuid; r jsonb;
BEGIN
  SELECT school_id, parent_id, child_id, item_a INTO v_school, v_parent, v_child, v_item FROM _p;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, NULL, 'smoke-key-0002', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'atleta_requerido' THEN RAISE EXCEPTION 'FAIL 4a: %', r; END IF;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, gen_random_uuid(), 'smoke-key-0003', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'atleta_no_valido' THEN RAISE EXCEPTION 'FAIL 4b: %', r; END IF;
  r := public.wa_crear_cobro_suelto(v_school, v_item, gen_random_uuid(), v_child, 'smoke-key-0004', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'familia_no_valida' THEN RAISE EXCEPTION 'FAIL 4c: %', r; END IF;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'corta', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'clave_invalida' THEN RAISE EXCEPTION 'FAIL 4d: %', r; END IF;
  r := public.wa_crear_cobro_suelto(gen_random_uuid(), v_item, v_parent, v_child, 'smoke-key-0005', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'ventas_deshabilitadas' THEN RAISE EXCEPTION 'FAIL 4e otra escuela: %', r; END IF;
  RAISE NOTICE 'OK 4 familia/atleta/clave ✓';
END $$;

-- ── 5. Cobro creado + idempotencia + ya_inscrito + clave_reutilizada ─────────
DO $$
DECLARE v_school uuid; v_parent uuid; v_child uuid; v_item uuid; v_item_b uuid; r jsonb; r2 jsonb; p record;
BEGIN
  SELECT school_id, parent_id, child_id, item_a INTO v_school, v_parent, v_child, v_item FROM _p;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0100', NULL, 60);
  IF NOT (r->>'ok')::boolean OR (r->>'idempotente')::boolean THEN RAISE EXCEPTION 'FAIL 5a: %', r; END IF;
  UPDATE _p SET pay_a = (r->>'payment_id')::uuid;

  SELECT * INTO p FROM public.payments WHERE id = (r->>'payment_id')::uuid;
  IF p.status <> 'pending' OR p.amount <> 25000 OR p.payment_category <> 'clase_extra'
     OR NOT p.period_uniqueness_exempt OR p.payment_type <> 'one_time'
     OR p.parent_id <> v_parent OR p.child_id <> v_child OR p.school_id <> v_school
     OR p.concept NOT LIKE 'Clase de perfeccionamiento · %' THEN
    RAISE EXCEPTION 'FAIL 5a fila payments: %', to_jsonb(p);
  END IF;
  IF (r->>'cupos_restantes')::int <> 0 THEN RAISE EXCEPTION 'FAIL 5a cupos_restantes: %', r; END IF;
  IF (r->>'vence_at')::timestamptz NOT BETWEEN now() + interval '59 minutes' AND now() + interval '61 minutes' THEN
    RAISE EXCEPTION 'FAIL 5a vence_at: %', r;
  END IF;

  -- Doble toque: misma clave → mismo cobro.
  r2 := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0100', NULL, 60);
  IF NOT (r2->>'ok')::boolean OR NOT (r2->>'idempotente')::boolean OR r2->>'payment_id' <> r->>'payment_id' THEN
    RAISE EXCEPTION 'FAIL 5b idempotencia: %', r2;
  END IF;
  IF (SELECT count(*) FROM public.wa_cobros_sueltos WHERE item_id = v_item) <> 1 THEN
    RAISE EXCEPTION 'FAIL 5b: se crearon dos cobros';
  END IF;

  -- Otra clave, mismo atleta → ya_inscrito con el cobro existente.
  r2 := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0101', NULL, 60);
  IF r2->>'codigo' IS DISTINCT FROM 'ya_inscrito' OR r2->>'payment_id' <> r->>'payment_id' THEN
    RAISE EXCEPTION 'FAIL 5c ya_inscrito: %', r2;
  END IF;

  -- Misma clave para otro ítem → clave_reutilizada.
  INSERT INTO public.school_tournament_items (school_id, name, price, kind, per_athlete)
  VALUES (v_school, 'Vacacional octubre', 300000, 'vacacional', false) RETURNING id INTO v_item_b;
  UPDATE _p SET item_b = v_item_b;
  r2 := public.wa_crear_cobro_suelto(v_school, v_item_b, v_parent, v_child, 'smoke-key-0100', NULL, 60);
  IF r2->>'codigo' IS DISTINCT FROM 'clave_reutilizada' THEN RAISE EXCEPTION 'FAIL 5d: %', r2; END IF;

  -- Ítem por familia (per_athlete=false) sin atleta → ok, categoría vacacional.
  r2 := public.wa_crear_cobro_suelto(v_school, v_item_b, v_parent, NULL, 'smoke-key-0200', NULL, 60);
  IF NOT (r2->>'ok')::boolean OR r2->>'categoria' <> 'vacacional' THEN RAISE EXCEPTION 'FAIL 5e: %', r2; END IF;
  RAISE NOTICE 'OK 5 cobro, idempotencia, ya_inscrito, clave_reutilizada ✓';
END $$;

-- ── 6. Cupos e ítem no vendible ─────────────────────────────────────────────
DO $$
DECLARE v_school uuid; v_parent uuid; v_child uuid; v_item uuid; v_pid uuid; r jsonb;
BEGIN
  SELECT school_id, parent_id, child_id INTO v_school, v_parent, v_child FROM _p;
  INSERT INTO public.school_tournament_items (school_id, name, price, kind, capacity)
  VALUES (v_school, 'Torneo cupo uno', 50000, 'torneo', 1) RETURNING id INTO v_item;
  UPDATE _p SET item_c = v_item;
  -- Otra familia ya tomó el único cupo (fila puente directa, sin atleta).
  INSERT INTO public.payments (school_id, parent_id, amount, concept, due_date, status, payment_type,
                               payment_category, period_uniqueness_exempt)
  VALUES (v_school, v_parent, 50000, 'smoke cupo ocupado', current_date, 'pending', 'one_time', 'torneo', true)
  RETURNING id INTO v_pid;
  INSERT INTO public.wa_cobros_sueltos (payment_id, school_id, item_id, parent_id, idempotency_key, vence_at)
  VALUES (v_pid, v_school, v_item, v_parent, 'smoke-key-0300', now() + interval '1 hour');

  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0301', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'sin_cupos' THEN RAISE EXCEPTION 'FAIL 6a sin_cupos: %', r; END IF;

  UPDATE public.school_tournament_items SET capacity = NULL, active = false WHERE id = v_item;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0302', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'item_no_disponible' THEN RAISE EXCEPTION 'FAIL 6b inactivo: %', r; END IF;

  UPDATE public.school_tournament_items SET active = true, starts_at = now() - interval '2 hours' WHERE id = v_item;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0303', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'item_vencido' THEN RAISE EXCEPTION 'FAIL 6c vencido: %', r; END IF;

  UPDATE public.school_tournament_items SET starts_at = NULL, price = 0 WHERE id = v_item;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0304', NULL, 60);
  IF r->>'codigo' IS DISTINCT FROM 'item_sin_precio' THEN RAISE EXCEPTION 'FAIL 6d precio 0: %', r; END IF;
  RAISE NOTICE 'OK 6 cupos e ítem no vendible ✓';
END $$;

-- ── 7. Anulación de vencidos ────────────────────────────────────────────────
DO $$
DECLARE v_pay uuid; v_item_b uuid; v_aw uuid; r jsonb; p record; w record;
BEGIN
  SELECT pay_a, item_b INTO v_pay, v_item_b FROM _p;
  -- El cobro de 5a venció hace 2 h; el de 5e (vacacional) pasa a awaiting_approval
  -- (la familia mandó comprobante) y también vence: NO se debe tocar.
  UPDATE public.wa_cobros_sueltos SET vence_at = now() - interval '2 hours' WHERE payment_id = v_pay;
  SELECT payment_id INTO v_aw FROM public.wa_cobros_sueltos WHERE item_id = v_item_b;
  UPDATE public.payments SET status = 'awaiting_approval' WHERE id = v_aw;
  UPDATE public.wa_cobros_sueltos SET vence_at = now() - interval '2 hours' WHERE payment_id = v_aw;

  r := public.wa_anular_cobros_sueltos_vencidos(1000, 15);
  IF NOT (r->'payment_ids') @> to_jsonb(v_pay::text) THEN RAISE EXCEPTION 'FAIL 7a no anuló: %', r; END IF;
  IF (r->'payment_ids') @> to_jsonb(v_aw::text) THEN RAISE EXCEPTION 'FAIL 7b anuló un awaiting_approval'; END IF;

  SELECT status, rejection_reason INTO p FROM public.payments WHERE id = v_pay;
  IF p.status <> 'cancelled' OR p.rejection_reason <> 'venta_whatsapp_vencida' THEN
    RAISE EXCEPTION 'FAIL 7a fila: % %', p.status, p.rejection_reason;
  END IF;
  SELECT anulado_at, anulado_motivo INTO w FROM public.wa_cobros_sueltos WHERE payment_id = v_pay;
  IF w.anulado_at IS NULL OR w.anulado_motivo <> 'venta_whatsapp_vencida' THEN RAISE EXCEPTION 'FAIL 7a puente'; END IF;
  IF (SELECT status FROM public.payments WHERE id = v_aw) <> 'awaiting_approval' THEN RAISE EXCEPTION 'FAIL 7b'; END IF;

  -- Idempotente: la segunda pasada no vuelve a tocarlo.
  r := public.wa_anular_cobros_sueltos_vencidos(1000, 15);
  IF (r->'payment_ids') @> to_jsonb(v_pay::text) THEN RAISE EXCEPTION 'FAIL 7c: anuló dos veces'; END IF;
  RAISE NOTICE 'OK 7 anulación de vencidos ✓';
END $$;

-- ── 8. Cupo liberado tras la anulación ───────────────────────────────────────
DO $$
DECLARE v_school uuid; v_parent uuid; v_child uuid; v_item uuid; r jsonb;
BEGIN
  SELECT school_id, parent_id, child_id, item_a INTO v_school, v_parent, v_child, v_item FROM _p;
  r := public.wa_catalogo_servicios(v_school, NULL, 20);
  IF ((SELECT x FROM jsonb_array_elements(r->'items') x WHERE x->>'id' = v_item::text)->>'cupos_restantes')::int <> 1 THEN
    RAISE EXCEPTION 'FAIL 8: el cupo no se liberó: %', r;
  END IF;
  r := public.wa_crear_cobro_suelto(v_school, v_item, v_parent, v_child, 'smoke-key-0400', NULL, 60);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL 8: no se pudo recomprar: %', r; END IF;
  RAISE NOTICE 'OK 8 cupo liberado ✓';
END $$;

-- ── 9. open_month ya no confunde un cobro de servicio con la mensualidad ────
DO $$
BEGIN
  IF (SELECT prosrc FROM pg_proc WHERE oid = 'public.open_month(uuid,integer,integer,uuid)'::regprocedure)
       NOT LIKE '%''articulos'', ''torneo'', ''clase_extra'', ''vacacional'', ''viaje''%' THEN
    RAISE EXCEPTION 'FAIL 9: open_month sin la exclusión de cobros de servicio';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.open_month(uuid,integer,integer,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.open_month(uuid,integer,integer,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL 9: cambió la ACL de open_month';
  END IF;
  RAISE NOTICE 'OK 9 open_month ✓';
END $$;

ROLLBACK;
