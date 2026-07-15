-- ============================================================
-- SPORTMAPS — Tests Fase 1 · Módulo de Dotación
--
-- Ejecutar:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/equipment_module_test.sql
--
-- No requiere fixtures de auth (que varían por entorno): valida los invariantes
-- de esquema/constraints (el backstop real de concurrencia), RLS, grants,
-- AISLAMIENTO del marketplace, y simula la aritmética de stock del criterio #5.
-- El test de concurrencia con dos sesiones va documentado al final (§6).
-- Todo corre y no deja datos (usa tablas TEMP y consultas de catálogo).
-- ============================================================
\set ON_ERROR_STOP on

-- ─── §1. Constraints de invariantes de stock (tabla real) ─────────────────────
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM pg_constraint
     WHERE conrelid = 'public.equipment_items'::regclass
       AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%quantity_available >= 0%';
    IF n = 0 THEN RAISE EXCEPTION 'FALLA §1: falta CHECK quantity_available >= 0 (backstop de concurrencia)'; END IF;

    SELECT count(*) INTO n FROM pg_constraint
     WHERE conrelid = 'public.equipment_items'::regclass
       AND conname = 'equipment_items_available_lte_total';
    IF n = 0 THEN RAISE EXCEPTION 'FALLA §1: falta CHECK quantity_available <= quantity_total'; END IF;

    SELECT count(*) INTO n FROM pg_constraint
     WHERE conrelid = 'public.equipment_assignments'::regclass
       AND conname = 'equipment_assignments_returned_lte_qty';
    IF n = 0 THEN RAISE EXCEPTION 'FALLA §1: falta CHECK returned_quantity <= quantity'; END IF;

    RAISE NOTICE 'OK §1 — constraints de invariantes de stock presentes';
END $$;

-- ─── §2. RLS habilitado en las 5 tablas ───────────────────────────────────────
DO $$
DECLARE t text; n int;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'equipment_settings','equipment_items','equipment_assignments',
        'equipment_returns','equipment_assignment_logs'
    ] LOOP
        SELECT count(*) INTO n FROM pg_class
         WHERE oid = ('public.'||t)::regclass AND relrowsecurity = true;
        IF n = 0 THEN RAISE EXCEPTION 'FALLA §2: RLS no habilitado en %', t; END IF;
    END LOOP;
    RAISE NOTICE 'OK §2 — RLS habilitado en las 5 tablas';
END $$;

-- ─── §3. RPCs existen y tienen EXECUTE para authenticated ─────────────────────
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
        BEGIN
            oid_ := f::regprocedure;
        EXCEPTION WHEN undefined_function THEN
            RAISE EXCEPTION 'FALLA §3: RPC no existe: %', f;
        END;
        IF NOT has_function_privilege('authenticated', oid_, 'EXECUTE') THEN
            RAISE EXCEPTION 'FALLA §3: authenticated sin EXECUTE en %', f;
        END IF;
    END LOOP;
    RAISE NOTICE 'OK §3 — % RPCs presentes con EXECUTE para authenticated', array_length(fns,1);
END $$;

-- ─── §4. AISLAMIENTO: ninguna función del módulo toca el marketplace ──────────
DO $$
DECLARE r record; body text; bad text;
BEGIN
    FOR r IN
        SELECT p.oid, p.proname
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND (p.proname LIKE 'equipment\_%' OR p.proname LIKE '\_equipment\_%' OR p.proname = '_next_equipment_folio')
    LOOP
        body := pg_get_functiondef(r.oid);
        FOREACH bad IN ARRAY ARRAY['products','product_variants','stock_holds','inventory_transactions'] LOOP
            -- \m word-boundary para no matchear 'equipment_' u otros
            IF body ~* ('(^|[^a-z_])'||bad||'([^a-z_]|$)') THEN
                RAISE EXCEPTION 'FALLA §4: la función % referencia tabla del marketplace: %', r.proname, bad;
            END IF;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'OK §4 — cero acoplamiento con el marketplace';
END $$;

-- ─── §5. Aritmética de stock (criterio #5) — simulación determinística ─────────
-- Replica en una TEMP TABLE con los mismos CHECKs lo que hacen los RPCs:
--   item total=10, avail=10 → asignar 6 (avail=4) → devolver 5 bueno (avail=9)
--   → devolver 1 perdido (total=9, avail=9) → cerrar. Invariante avail<=total OK.
DO $$
DECLARE v_avail int; v_total int;
BEGIN
    CREATE TEMP TABLE _t_item (
        total int NOT NULL CHECK (total >= 0),
        avail int NOT NULL CHECK (avail >= 0),
        CONSTRAINT _t_avail_lte_total CHECK (avail <= total)
    ) ON COMMIT DROP;

    INSERT INTO _t_item VALUES (10, 10);

    -- asignar 6 (reserva)
    UPDATE _t_item SET avail = avail - 6;
    -- devolver 5 en buen estado (regresa a disponible)
    UPDATE _t_item SET avail = avail + 5;
    -- devolver 1 perdido (NO regresa avail; baja quantity_total con log)
    UPDATE _t_item SET total = total - 1;

    SELECT avail, total INTO v_avail, v_total FROM _t_item;
    IF v_avail <> 9 THEN RAISE EXCEPTION 'FALLA §5: avail esperado 9, obtenido %', v_avail; END IF;
    IF v_total <> 9 THEN RAISE EXCEPTION 'FALLA §5: total esperado 9, obtenido %', v_total; END IF;

    -- El CHECK avail>=0 debe rechazar sobre-reserva (backstop de concurrencia)
    BEGIN
        UPDATE _t_item SET avail = avail - 100;
        RAISE EXCEPTION 'FALLA §5: se permitió avail negativo (backstop roto)';
    EXCEPTION WHEN check_violation THEN
        NULL; -- esperado
    END;

    RAISE NOTICE 'OK §5 — aritmética de stock y backstop de negativos correctos';
END $$;

-- ============================================================
-- §6. Test de concurrencia REAL (manual, dos sesiones psql)
--     El último balón: dos coaches lo toman a la vez → uno gana, el otro
--     recibe "Stock insuficiente"; avail nunca queda negativo.
--
--   Requiere una escuela, un ítem con avail=1, y dos coaches activos con JWT.
--   Sesión A y B (cada una en su psql), con request.jwt.claims seteado al sub
--   de cada coach:
--
--   -- Sesión A:
--   BEGIN;
--   SELECT set_config('request.jwt.claims','{"sub":"<COACH_A>","role":"authenticated"}', true);
--   SELECT public.equipment_self_checkout('<ITEM>', 1, 'https://x/f.jpg');  -- toma FOR UPDATE, NO commit aún
--
--   -- Sesión B (queda BLOQUEADA en el FOR UPDATE hasta que A haga COMMIT):
--   BEGIN;
--   SELECT set_config('request.jwt.claims','{"sub":"<COACH_B>","role":"authenticated"}', true);
--   SELECT public.equipment_self_checkout('<ITEM>', 1, 'https://x/f.jpg');
--
--   -- Sesión A:
--   COMMIT;   -- A gana; avail pasa a 0
--   -- Sesión B: se desbloquea y falla con 'Stock insuficiente (disponible 0, solicitado 1)'
--   ROLLBACK; -- en B
--
--   Resultado esperado: exactamente 1 asignación creada; equipment_items.avail = 0
--   (nunca -1). El FOR UPDATE serializa; el CHECK avail>=0 es el backstop final.
-- ============================================================

\echo '======================================'
\echo ' TODOS LOS TESTS DE FASE 1 PASARON (§1-§5). §6 es manual (2 sesiones).'
\echo '======================================'
