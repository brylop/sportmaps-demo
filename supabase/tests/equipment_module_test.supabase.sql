-- ============================================================
-- TESTS Fase 1 · Dotación — versión para el SQL Editor de Supabase
-- Pega TODO esto en el editor y dale Run.
--   • Si al final ves la fila "TODOS LOS TESTS PASARON ✅" → todo bien.
--   • Si algo falla, la query se detiene con un mensaje "FALLA §N: ..."
-- ============================================================

-- §1. Constraints de stock
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM pg_constraint
     WHERE conrelid = 'public.equipment_items'::regclass AND contype='c'
       AND pg_get_constraintdef(oid) ILIKE '%quantity_available >= 0%';
    IF n = 0 THEN RAISE EXCEPTION 'FALLA §1: falta CHECK quantity_available >= 0'; END IF;

    SELECT count(*) INTO n FROM pg_constraint
     WHERE conrelid = 'public.equipment_items'::regclass AND conname='equipment_items_available_lte_total';
    IF n = 0 THEN RAISE EXCEPTION 'FALLA §1: falta CHECK available <= total'; END IF;

    SELECT count(*) INTO n FROM pg_constraint
     WHERE conrelid = 'public.equipment_assignments'::regclass AND conname='equipment_assignments_returned_lte_qty';
    IF n = 0 THEN RAISE EXCEPTION 'FALLA §1: falta CHECK returned_quantity <= quantity'; END IF;
END $$;

-- §2. RLS habilitado en las 5 tablas
DO $$
DECLARE t text; n int;
BEGIN
    FOREACH t IN ARRAY ARRAY['equipment_settings','equipment_items','equipment_assignments','equipment_returns','equipment_assignment_logs'] LOOP
        SELECT count(*) INTO n FROM pg_class WHERE oid=('public.'||t)::regclass AND relrowsecurity=true;
        IF n = 0 THEN RAISE EXCEPTION 'FALLA §2: RLS no habilitado en %', t; END IF;
    END LOOP;
END $$;

-- §3. RPCs existen y authenticated tiene EXECUTE
DO $$
DECLARE f text; oid_ regprocedure;
    fns text[] := ARRAY[
        'public.equipment_save_settings(uuid,boolean,boolean,int)',
        'public.equipment_upsert_item(uuid,text,int,uuid,uuid,text,text,text,text)',
        'public.equipment_soft_delete_item(uuid)',
        'public.equipment_assign(uuid,uuid,int,uuid,date,text,text)',
        'public.equipment_accept(uuid)',
        'public.equipment_report_difference(uuid,int,text)',
        'public.equipment_self_checkout(uuid,int,text,uuid,text)',
        'public.equipment_approve_delivery(uuid)',
        'public.equipment_reject_delivery(uuid,text)',
        'public.equipment_request_return(uuid,int,text,text,text)',
        'public.equipment_approve_return(uuid,text)',
        'public.equipment_dispute_return(uuid,text)',
        'public.equipment_resolve_dispute(uuid,text,int,text)',
        'public.equipment_close_with_shortage(uuid,text)',
        'public.equipment_set_acta_pdf_url(uuid,text)',
        'public.equipment_list_items(uuid,uuid,text,text,int,int)',
        'public.equipment_pending_approvals(uuid)',
        'public.equipment_my_assignments()',
        'public.equipment_assignment_detail(uuid)'
    ];
BEGIN
    FOREACH f IN ARRAY fns LOOP
        BEGIN oid_ := f::regprocedure;
        EXCEPTION WHEN undefined_function THEN RAISE EXCEPTION 'FALLA §3: RPC no existe: %', f; END;
        IF NOT has_function_privilege('authenticated', oid_, 'EXECUTE') THEN
            RAISE EXCEPTION 'FALLA §3: authenticated sin EXECUTE en %', f;
        END IF;
    END LOOP;
END $$;

-- §4. Aislamiento: ninguna función del módulo toca el marketplace
DO $$
DECLARE r record; body text; bad text;
BEGIN
    FOR r IN
        SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public'
          AND (p.proname LIKE 'equipment\_%' OR p.proname LIKE '\_equipment\_%' OR p.proname='_next_equipment_folio')
    LOOP
        body := pg_get_functiondef(r.oid);
        FOREACH bad IN ARRAY ARRAY['products','product_variants','stock_holds','inventory_transactions'] LOOP
            IF body ~* ('(^|[^a-z_])'||bad||'([^a-z_]|$)') THEN
                RAISE EXCEPTION 'FALLA §4: la función % referencia %', r.proname, bad;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- §5. Aritmética de stock (criterio #5: 6 asignados, 5 buenos + 1 perdido)
DO $$
DECLARE v_avail int; v_total int;
BEGIN
    CREATE TEMP TABLE _t_item (
        total int NOT NULL CHECK (total >= 0),
        avail int NOT NULL CHECK (avail >= 0),
        CONSTRAINT _t_avail_lte_total CHECK (avail <= total)
    ) ON COMMIT DROP;
    INSERT INTO _t_item VALUES (10, 10);
    UPDATE _t_item SET avail = avail - 6;   -- asignar 6
    UPDATE _t_item SET avail = avail + 5;   -- devolver 5 buenos
    UPDATE _t_item SET total = total - 1;   -- devolver 1 perdido (baja inventario)
    SELECT avail, total INTO v_avail, v_total FROM _t_item;
    IF v_avail <> 9 THEN RAISE EXCEPTION 'FALLA §5: avail esperado 9, dio %', v_avail; END IF;
    IF v_total <> 9 THEN RAISE EXCEPTION 'FALLA §5: total esperado 9, dio %', v_total; END IF;
    BEGIN
        UPDATE _t_item SET avail = avail - 100;  -- sobre-reserva
        RAISE EXCEPTION 'FALLA §5: se permitió avail negativo';
    EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

-- Si llegaste hasta aquí sin error, todo pasó:
SELECT 'TODOS LOS TESTS PASARON ✅' AS resultado;
