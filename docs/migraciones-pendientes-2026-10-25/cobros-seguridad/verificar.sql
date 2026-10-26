-- =============================================================================
-- verificar.sql — seguridad de cobros (2026-10-25)
-- Prueba en la base viva, SIN dejar nada: todo corre en UNA transacción y el
-- bloque termina con RAISE EXCEPTION a propósito, que deshace todo. El editor
-- de Supabase lo muestra como «error»: el texto es el resultado.
--   · «RESULTADO OK …»    → todas las pruebas pasaron.
--   · «FALLA <n>: …»      → se detuvo en esa prueba (también se deshizo todo).
-- Se puede correr ANTES o DESPUÉS de pegar 01_payments_monto_servidor_despues_de_s4.sql:
-- detecta cuál trigger está vivo y dice qué regla probó.
-- Datos: Escuela Demo SportMaps (de300000-…-001) y dos acudientes demo con hijo
-- activo y correo. Crea (y deshace) una integración de WhatsApp de prueba.
-- Sin tablas temporales ni RAISE NOTICE (el editor no los soporta bien).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

DO $verif$
DECLARE
    c_school  constant uuid := 'de300000-0000-4000-8000-000000000001';
    c_viejo   constant uuid := '0da7ceca-4359-45ab-a51b-263ccefea0c9';  -- acudiente demo A
    c_nuevo   constant uuid := '4b2e1911-a5b5-4071-9dc4-3e152fb9041c';  -- acudiente demo B
    c_child   constant uuid := 'de350000-0000-4000-8000-000000000003';  -- hijo activo de B
    c_tel     constant text := '573009991122';
    v_integ   uuid;
    v_q       uuid;
    v_ids     uuid[] := ARRAY[]::uuid[];
    v_i       int;
    r         jsonb;
    v_conv    record;
    v_tarifa  numeric;
    v_id      uuid;
    v_amount  numeric;
    v_src     text;
    v_regla   text;
    v_ok      text[] := ARRAY[]::text[];
    f         text;
BEGIN
    -- ── Datos de prueba existen ───────────────────────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM public.children c
                    WHERE c.id = c_child AND c.parent_id = c_nuevo AND c.school_id = c_school AND c.is_active) THEN
        RAISE EXCEPTION 'FALLA datos: el hijo demo % ya no es de % en la Escuela Demo (elegir otros)', c_child, c_nuevo;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.children c WHERE c.parent_id = c_viejo AND c.school_id = c_school AND c.is_active) THEN
        RAISE EXCEPTION 'FALLA datos: el acudiente demo % ya no tiene hijo activo en la Escuela Demo', c_viejo;
    END IF;

    v_regla := CASE
        WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.payments'::regclass
                      AND tgname = 'trg_zzyz_payments_monto_servidor' AND NOT tgisinternal) THEN 'despues_de_s4'
        WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.payments'::regclass
                      AND tgname = 'trg_zz_payments_monto_servidor' AND NOT tgisinternal) THEN 'antes_de_s4'
        ELSE 'sin_marca' END;
    IF v_regla = 'sin_marca' THEN
        RAISE EXCEPTION 'FALLA 0: no hay trigger de amount_source en payments';
    END IF;

    -- ── 0. Permisos ───────────────────────────────────────────────────────────
    FOREACH f IN ARRAY ARRAY[
        'public.wa_reservar_cupo_ocr(uuid)',
        'public.wa_iniciar_revinculacion(uuid,text,text,timestamp with time zone)',
        'public.wa_identify_by_phone(uuid,text)',
        'public.auto_approve_payment(uuid)',
        'public.bank_email_notice_apply(uuid,text,uuid,jsonb)'] LOOP
        IF to_regprocedure(f) IS NULL THEN
            RAISE EXCEPTION 'FALLA 0: no existe %', f;
        END IF;
        IF has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE') THEN
            RAISE EXCEPTION 'FALLA 0: % abierta a anon/authenticated', f;
        END IF;
    END LOOP;
    IF has_table_privilege('anon', 'public.wa_ocr_cupos', 'SELECT')
       OR has_table_privilege('authenticated', 'public.wa_ocr_cupos', 'SELECT') THEN
        RAISE EXCEPTION 'FALLA 0: wa_ocr_cupos legible por anon/authenticated';
    END IF;
    IF has_table_privilege('anon', 'public.bank_email_notices', 'SELECT')
       OR has_table_privilege('anon', 'public.bank_email_inboxes', 'SELECT') THEN
        RAISE EXCEPTION 'FALLA 0: tablas de conciliación legibles por anon';
    END IF;
    v_ok := v_ok || 'permisos'::text;

    -- ── 1. Límite de OCR: tope 2 por número en 60 min ─────────────────────────
    INSERT INTO public.school_whatsapp_integrations (school_id, phone_number_id)
    VALUES (c_school, 'verif-' || gen_random_uuid()::text)
    RETURNING id INTO v_integ;
    INSERT INTO public.whatsapp_settings (integration_id)
    SELECT v_integ WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_settings WHERE integration_id = v_integ);
    UPDATE public.whatsapp_settings
       SET limite_comprobantes_por_numero = 2, limite_comprobantes_ventana_min = 60
     WHERE integration_id = v_integ;

    FOR v_i IN 1..3 LOOP
        INSERT INTO public.whatsapp_inbound_queue (school_id, integration_id, wa_phone_number, wa_message_id, message_type)
        VALUES (c_school, v_integ, '573009998877', 'verif-cupo-' || v_i || '-' || gen_random_uuid()::text, 'image')
        RETURNING id INTO v_q;
        v_ids := v_ids || v_q;
    END LOOP;
    r := public.wa_reservar_cupo_ocr(v_ids[1]);
    IF (r->>'permitido')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLA 1a: el primero debía pasar: %', r; END IF;
    r := public.wa_reservar_cupo_ocr(v_ids[2]);
    IF (r->>'permitido')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLA 1b: el segundo debía pasar: %', r; END IF;
    r := public.wa_reservar_cupo_ocr(v_ids[3]);
    IF (r->>'permitido')::boolean OR r->>'motivo' <> 'limite_numero' THEN RAISE EXCEPTION 'FALLA 1c: el tercero debía frenarse: %', r; END IF;
    r := public.wa_reservar_cupo_ocr(v_ids[1]);
    IF (r->>'repetido')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLA 1d: reintento no idempotente: %', r; END IF;
    v_ok := v_ok || 'limite_ocr'::text;

    -- ── 2. Revinculación con código por correo ────────────────────────────────
    UPDATE public.profiles SET phone = '3009991122' WHERE id = c_nuevo;
    UPDATE public.profiles SET phone = '3000000001' WHERE id = c_viejo;
    INSERT INTO public.whatsapp_conversations (integration_id, school_id, contact_wa_id, parent_id, identified)
    VALUES (v_integ, c_school, c_tel, c_viejo, true);

    r := public.wa_identify_by_phone(v_integ, c_tel);
    IF r->>'estado' IS DISTINCT FROM 'revinculacion_pendiente' OR r ? 'parent_id' THEN
        RAISE EXCEPTION 'FALLA 2a: número de otro acudiente no quedó pendiente: %', r;
    END IF;
    SELECT parent_id, identified INTO v_conv FROM public.whatsapp_conversations
     WHERE integration_id = v_integ AND contact_wa_id = c_tel;
    IF v_conv.parent_id IS NOT NULL OR v_conv.identified THEN
        RAISE EXCEPTION 'FALLA 2b: la conversación sigue vinculada al acudiente anterior';
    END IF;
    r := public.wa_identify_by_phone(v_integ, c_tel);
    IF r->>'estado' IS DISTINCT FROM 'revinculacion_pendiente' THEN RAISE EXCEPTION 'FALLA 2c: el segundo mensaje vinculó: %', r; END IF;
    r := public.wa_iniciar_revinculacion(v_integ, c_tel, encode(sha256('482913'::bytea), 'hex'), now() + interval '10 minutes');
    IF (r->>'ok')::boolean IS NOT TRUE OR r->>'email' IS NULL THEN RAISE EXCEPTION 'FALLA 2d: %', r; END IF;
    r := public.wa_iniciar_revinculacion(v_integ, c_tel, encode(sha256('111111'::bytea), 'hex'), now() + interval '10 minutes');
    IF r->>'motivo' IS DISTINCT FROM 'codigo_vigente' THEN RAISE EXCEPTION 'FALLA 2e: emitió otro código: %', r; END IF;
    r := public.wa_verify_otp(v_integ, c_tel, encode(sha256('000000'::bytea), 'hex'));
    IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FALLA 2f: aceptó un código equivocado'; END IF;
    r := public.wa_verify_otp(v_integ, c_tel, encode(sha256('482913'::bytea), 'hex'));
    IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'parent_id')::uuid IS DISTINCT FROM c_nuevo THEN RAISE EXCEPTION 'FALLA 2g: %', r; END IF;
    r := public.wa_identify_by_phone(v_integ, c_tel);
    IF r->>'estado' IS DISTINCT FROM 'identificado' OR (r->>'parent_id')::uuid IS DISTINCT FROM c_nuevo THEN
        RAISE EXCEPTION 'FALLA 2h: tras el código no quedó con el acudiente nuevo: %', r;
    END IF;
    v_ok := v_ok || 'revinculacion'::text;

    -- ── 3. Monto del servidor, como el acudiente B por PostgREST ──────────────
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', c_nuevo, 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);

    -- 3a. Mensualidad por $1: S4 la deja con la tarifa. Fecha lejana para no
    --     chocar con el cobro real del mes (una mensualidad ocupa su período).
    INSERT INTO public.payments (parent_id, child_id, school_id, amount, concept, status,
                                 payment_type, due_date, payment_category)
    VALUES (c_nuevo, c_child, c_school, 1, 'Mensualidad verificación', 'pending',
            'one_time', DATE '2029-03-15', 'mensualidad')
    RETURNING id, amount, amount_source INTO v_id, v_amount, v_src;
    IF v_amount <= 1 THEN RAISE EXCEPTION 'FALLA 3a: S4 no puso la tarifa (quedó %)', v_amount; END IF;
    v_tarifa := v_amount;
    IF v_regla = 'despues_de_s4' AND v_src <> 'servidor' THEN
        RAISE EXCEPTION 'FALLA 3a: con la marca después de S4, la mensualidad tarifada debía ser servidor (es %)', v_src;
    END IF;
    IF v_regla = 'antes_de_s4' AND v_src <> 'cliente' THEN
        RAISE EXCEPTION 'FALLA 3a: con la marca antes de S4 se esperaba cliente (es %)', v_src;
    END IF;

    -- 3b. Mensualidad con la tarifa exacta: servidor con cualquiera de las dos reglas.
    INSERT INTO public.payments (parent_id, child_id, school_id, amount, concept, status,
                                 payment_type, due_date, payment_category)
    VALUES (c_nuevo, c_child, c_school, v_tarifa, 'Mensualidad verificación', 'pending',
            'one_time', DATE '2029-04-15', 'mensualidad')
    RETURNING amount_source INTO v_src;
    IF v_src <> 'servidor' THEN RAISE EXCEPTION 'FALLA 3b: mensualidad con la tarifa quedó %', v_src; END IF;

    -- 3c. Abono libre: cliente.
    INSERT INTO public.payments (parent_id, child_id, school_id, amount, concept, status,
                                 payment_type, due_date, payment_category, period_uniqueness_exempt)
    VALUES (c_nuevo, c_child, c_school, 1, 'Pago / Abono verificación', 'pending',
            'one_time', DATE '2029-05-15', 'otro', true)
    RETURNING id, amount_source INTO v_id, v_src;
    IF v_src <> 'cliente' THEN RAISE EXCEPTION 'FALLA 3c: abono no quedó cliente (es %)', v_src; END IF;

    -- 3d. Monto 0: rechazo (de la marca o del CHECK de la tabla).
    BEGIN
        INSERT INTO public.payments (parent_id, child_id, school_id, amount, concept, status,
                                     payment_type, due_date, payment_category, period_uniqueness_exempt)
        VALUES (c_nuevo, c_child, c_school, 0, 'Cero verificación', 'pending',
                'one_time', DATE '2029-06-15', 'otro', true);
        RAISE EXCEPTION 'FALLA 3d: aceptó un cobro de 0';
    EXCEPTION
        WHEN insufficient_privilege OR check_violation THEN NULL;
    END;

    -- 3e. El acudiente no cambia amount_source.
    BEGIN
        UPDATE public.payments SET amount_source = 'servidor' WHERE id = v_id;
        RAISE EXCEPTION 'FALLA 3e: el acudiente cambió amount_source';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;

    PERFORM set_config('role', 'none', true);   -- vuelve al usuario de la sesión
    PERFORM set_config('request.jwt.claims', '', true);

    -- 3f. auto_approve_payment no aprueba un monto del cliente.
    UPDATE public.payments SET status = 'awaiting_approval' WHERE id = v_id;
    IF public.auto_approve_payment(v_id) THEN RAISE EXCEPTION 'FALLA 3f: auto-aprobó un monto del cliente'; END IF;
    v_ok := v_ok || ('monto_servidor[' || v_regla || ']')::text;

    RAISE EXCEPTION 'RESULTADO OK (todo se deshizo): %', array_to_string(v_ok, ', ');
END
$verif$;

ROLLBACK;
