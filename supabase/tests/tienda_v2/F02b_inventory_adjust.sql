-- M-F0-2 (tienda v2 F0) — inventory_adjust: el único camino para mover stock.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F02b_inventory_adjust.sql
--
-- Casos del plan: R10 (variante ajena → NOT_OWNER), −1 → INVALID_QTY. Más: kardex
-- 'manual_adjust' con antes/después, producto con variantes → PRODUCT_HAS_VARIANTS,
-- camino del BFF (service role + p_actor), un usuario no se hace pasar por otro con
-- p_actor, el kardex no se borra (super admin incluido).

begin;

-- Guayos (d…003) del vendedor.ok, variante 38/Negro (e…004) con stock 2.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'vendedor.ok'), 'role', 'authenticated')::text, true);
select set_config('qa.u_ok',   (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.u_pend', (select user_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);
set local role authenticated;
do $$
declare r jsonb; v_log record;
begin
  r := public.inventory_adjust('00000000-0000-4000-e000-000000000004', null, 7, 'manual_restock', 'llegó pedido');
  if (r->>'stock_before')::int <> 2 or (r->>'stock_after')::int <> 7 or (r->>'delta')::int <> 5 then
    raise exception 'FALLO: respuesta inesperada %', r;
  end if;
  select * into v_log from public.inventory_logs
   where variant_id = '00000000-0000-4000-e000-000000000004' order by created_at desc limit 1;
  if v_log.id is null or v_log.delta <> 5 or v_log.stock_before <> 2 or v_log.stock_after <> 7
     or v_log.reason <> 'manual_restock' or v_log.created_by <> auth.uid() or v_log.note <> 'llegó pedido' then
    raise exception 'FALLO: kardex no quedo bien: %', row_to_json(v_log);
  end if;
  raise notice 'OK: dueño ajusta su variante 2→7 y queda kardex (manual_restock, created_by, nota)';

  r := public.inventory_adjust('00000000-0000-4000-e000-000000000004', null, 7);
  if not coalesce((r->>'noop')::boolean, false) then raise exception 'FALLO: mismo stock no es no-op: %', r; end if;
  raise notice 'OK: mismo stock → no-op sin kardex';

  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000004', null, -1);
    raise exception 'FALLO: stock negativo aceptado';
  exception when invalid_parameter_value then raise notice 'OK: −1 → INVALID_QTY (22023)';
  end;

  begin
    perform public.inventory_adjust(null, '00000000-0000-4000-d000-000000000003', 5);
    raise exception 'FALLO: ajuste por producto con variantes aceptado';
  exception when invalid_parameter_value then
    if sqlerrm <> 'PRODUCT_HAS_VARIANTS' then raise; end if;
    raise notice 'OK: producto con variantes → PRODUCT_HAS_VARIANTS';
  end;

  -- Producto sin variantes (balón d…002, stock 20)
  r := public.inventory_adjust(null, '00000000-0000-4000-d000-000000000002', 18, 'manual_adjust', null);
  if (r->>'stock_after')::int <> 18 then raise exception 'FALLO: ajuste de producto sin variantes: %', r; end if;
  raise notice 'OK: ajuste de producto sin variantes 20→18';

  -- p_actor de otro usuario se ignora con JWT de authenticated (no hay suplantación)
  r := public.inventory_adjust(null, '00000000-0000-4000-d000-000000000002', 17, 'manual_adjust', null,
                               current_setting('qa.u_pend')::uuid);
  if not exists (select 1 from public.inventory_logs
                  where product_id = '00000000-0000-4000-d000-000000000002' and stock_after = 17
                    and created_by = current_setting('qa.u_ok')::uuid) then
    raise exception 'FALLO: p_actor ajeno se uso como actor con JWT de usuario';
  end if;
  raise notice 'OK: con JWT de usuario, p_actor se ignora (actor = auth.uid())';
end $$;

-- ── R10: vendedor.pend sobre variante ajena ──────────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'vendedor.pend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000004', null, 0);
    raise exception 'FALLO: ajuste sobre variante ajena aceptado (R10)';
  exception when insufficient_privilege then
    if sqlerrm <> 'NOT_OWNER' then raise; end if;
    raise notice 'OK: R10 variante ajena → NOT_OWNER (42501)';
  end;
end $$;

-- ── anon: sin EXECUTE ────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000004', null, 0);
    raise exception 'FALLO: anon ejecuta inventory_adjust';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501';
  end;
end $$;

-- ── BFF: service role con p_actor ────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.inventory_adjust('00000000-0000-4000-e000-000000000005', null, 1, 'manual_adjust', 'bff',
                               current_setting('qa.u_ok')::uuid);
  if (r->>'stock_after')::int <> 1 then raise exception 'FALLO: service role + p_actor dueño: %', r; end if;
  raise notice 'OK: service role con p_actor = dueño ajusta';
  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000005', null, 0, 'manual_adjust', 'bff',
                                    current_setting('qa.u_pend')::uuid);
    raise exception 'FALLO: service role con p_actor ajeno ajusto';
  exception when insufficient_privilege then raise notice 'OK: service role con p_actor ajeno → NOT_OWNER';
  end;
  begin
    perform public.inventory_adjust('00000000-0000-4000-e000-000000000005', null, 0);
    raise exception 'FALLO: service role sin p_actor ajusto';
  exception when insufficient_privilege then raise notice 'OK: service role sin p_actor → NOT_AUTHENTICATED';
  end;
end $$;

-- ── Kardex append-only (R13/R14), super admin incluido ───────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'superadmin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.inventory_logs;
  if n = 0 then raise exception 'FALLO (control): el super admin no lee el kardex'; end if;
  begin
    delete from public.inventory_logs;
    raise exception 'FALLO: el super admin borro el kardex';
  exception when insufficient_privilege then raise notice 'OK: super admin lee (% filas) pero DELETE → 42501', n;
  end;
  begin
    update public.inventory_logs set delta = 0;
    raise exception 'FALLO: el super admin reescribio el kardex';
  exception when insufficient_privilege then raise notice 'OK: UPDATE del kardex → 42501';
  end;
end $$;

rollback;
