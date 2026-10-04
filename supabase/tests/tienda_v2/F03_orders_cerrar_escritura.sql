-- M-F0-3 (tienda v2 F0) — órdenes sin escritura del cliente (T3/T4 confirmados en
-- docs/qa/tienda-baseline-padre-2026-10-03.md §3), CHECK de estados, 'paid' con
-- prueba, historial y lectura por tienda.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F03_orders_cerrar_escritura.sql
--
-- Casos del plan: R5 (comprador INSERT orden paid → 42501), comprador UPDATE total
-- → 42501, service_role status='foo' → 23514, paid sin prueba → PAID_WITHOUT_PROOF,
-- flag_payment_for_review (DEFINER) ok, anon lee historial → 42501, R8 (comprador ve
-- su orden, ajeno 0 filas). Más: reproducción literal de los ataques del informe
-- (T3a/b/c, T3 paid, T4 orden + ítem a $1), con la tienda PRENDIDA (lo que M3 no
-- cubre), confirm_order_payment sobre pending_payment, y el admin de la escuela ve
-- los pedidos de su tienda.

begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre', (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.vp_ok',   (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);

-- Orden real (como la dejaría el BFF): padre.a compra 2 balones (d…002, $50.000) a vendedor.ok.
insert into public.orders (id, user_id, total_amount, vendor_profile_id, vendor_id, payment_provider, provider_reference)
values ('00000000-0000-4000-c000-0000000000f1', current_setting('qa.u_padre')::uuid, 100000,
        current_setting('qa.vp_ok')::uuid,
        (select user_id from qa_twin.actores where alias = 'vendedor.ok'), 'wompi', 'CART-QA-F03');
insert into public.order_items (order_id, product_id, quantity, unit_price, subtotal, vendor_id, vendor_profile_id)
values ('00000000-0000-4000-c000-0000000000f1', '00000000-0000-4000-d000-000000000002', 2, 50000, 100000,
        (select user_id from qa_twin.actores where alias = 'vendedor.ok'), current_setting('qa.vp_ok')::uuid);

do $$
begin
  if (select status from public.orders where id = '00000000-0000-4000-c000-0000000000f1') <> 'pending_payment' then
    raise exception 'FALLO: el default de status no es pending_payment';
  end if;
  raise notice 'OK: default status = pending_payment';
end $$;

-- ── Comprador (padre.a): T3 y T4 con la tienda prendida ──────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  -- R8: ve su orden y sus ítems
  select count(*) into n from public.orders where id = '00000000-0000-4000-c000-0000000000f1';
  if n <> 1 then raise exception 'FALLO (control): el comprador no ve su orden'; end if;
  select count(*) into n from public.order_items where order_id = '00000000-0000-4000-c000-0000000000f1';
  if n <> 1 then raise exception 'FALLO (control): el comprador no ve sus ítems'; end if;
  raise notice 'OK: R8 el comprador ve su orden y sus ítems';

  -- T3a / T3b / T3c / T3 paid
  begin
    update public.orders set total_amount = 1000 where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: T3a el comprador cambio el total';
  exception when insufficient_privilege then raise notice 'OK: T3a UPDATE total_amount → 42501';
  end;
  begin
    update public.orders set status = 'preparing' where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: T3b el comprador cambio el estado';
  exception when insufficient_privilege then raise notice 'OK: T3b UPDATE status → 42501';
  end;
  begin
    update public.orders set status = 'qa_estado_inventado' where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: T3c estado inventado';
  exception when insufficient_privilege then raise notice 'OK: T3c estado inventado → 42501';
  end;
  begin
    update public.orders set status = 'paid', total_amount = 1 where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: T3 el comprador se marco paid con total 1';
  exception when insufficient_privilege then raise notice 'OK: T3 paid + total 1 → 42501';
  end;

  -- R5 / T4
  begin
    insert into public.orders (user_id, total_amount, status) values (auth.uid(), 1000, 'paid');
    raise exception 'FALLO: R5 el comprador inserto una orden pagada';
  exception when insufficient_privilege then raise notice 'OK: R5 INSERT orden paid → 42501';
  end;
  begin
    insert into public.orders (user_id, total_amount) values (auth.uid(), 1);
    raise exception 'FALLO: T4 el comprador creo una orden de $1';
  exception when insufficient_privilege then raise notice 'OK: T4 INSERT orden $1 → 42501';
  end;
  begin
    insert into public.order_items (order_id, product_id, quantity, unit_price, vendor_id)
    values ('00000000-0000-4000-c000-0000000000f1', '00000000-0000-4000-d000-000000000002', 1, 1, auth.uid());
    raise exception 'FALLO: T4 el comprador agrego un ítem a $1';
  exception when insufficient_privilege then raise notice 'OK: T4 INSERT order_items $1 → 42501';
  end;
  begin
    delete from public.orders where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: el comprador borro su orden';
  exception when insufficient_privilege then raise notice 'OK: DELETE orden → 42501';
  end;

  -- Historial visible para el comprador
  select count(*) into n from public.order_status_history where order_id = '00000000-0000-4000-c000-0000000000f1';
  if n < 1 then raise exception 'FALLO: el comprador no ve el historial de su orden'; end if;
  raise notice 'OK: el comprador ve el historial (% fila/s)', n;
  begin
    insert into public.order_status_history (order_id, to_status, actor_role)
    values ('00000000-0000-4000-c000-0000000000f1', 'paid', 'buyer');
    raise exception 'FALLO: el comprador escribio historial';
  exception when insufficient_privilege then raise notice 'OK: INSERT historial → 42501';
  end;
end $$;

-- ── Cinturón: aunque vuelva el grant, el trigger frena al cliente ────────────
reset role;
grant update on public.orders to authenticated;
create policy qa_tmp_reabre on public.orders for update to authenticated using (true) with check (true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    update public.orders set total_amount = 1 where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: con grant y policy reabiertos el comprador escribe';
  exception when insufficient_privilege then
    if sqlerrm <> 'ORDER_WRITE_LOCKED' then raise; end if;
    raise notice 'OK: trg_zz_guard_orders frena aunque reaparezcan grant y policy (ORDER_WRITE_LOCKED)';
  end;
end $$;
reset role;
drop policy qa_tmp_reabre on public.orders;
revoke update on public.orders from authenticated;

-- ── Ajeno (padre.b): 0 filas ─────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare n int;
begin
  select count(*) into n from public.orders where id = '00000000-0000-4000-c000-0000000000f1';
  if n <> 0 then raise exception 'FALLO: R8 un ajeno ve la orden'; end if;
  select count(*) into n from public.order_status_history where order_id = '00000000-0000-4000-c000-0000000000f1';
  if n <> 0 then raise exception 'FALLO: un ajeno ve el historial'; end if;
  raise notice 'OK: R8 ajeno → 0 filas (orden e historial)';
end $$;

-- ── Vendedor ve la orden de su tienda ────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'vendedor.ok'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.orders where id = '00000000-0000-4000-c000-0000000000f1') then
    raise exception 'FALLO: el vendedor no ve la orden de su tienda';
  end if;
  raise notice 'OK: el vendedor ve la orden de su tienda';
end $$;

-- ── anon: nada ───────────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin
    perform 1 from public.order_status_history;
    raise exception 'FALLO: anon lee order_status_history';
  exception when insufficient_privilege then raise notice 'OK: anon historial → 42501';
  end;
  begin
    perform 1 from public.orders;
    raise exception 'FALLO: anon lee orders';
  exception when insufficient_privilege then raise notice 'OK: anon orders → 42501';
  end;
end $$;

-- ── BFF (service role): CHECK, prueba de pago, DEFINER y confirm_order_payment ─
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare r jsonb; v_stock int;
begin
  begin
    update public.orders set status = 'foo' where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: CHECK acepto status foo';
  exception when check_violation then raise notice 'OK: status foo → 23514';
  end;
  begin
    update public.orders set status = 'pending' where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: CHECK acepto el legacy pending';
  exception when check_violation then raise notice 'OK: status legacy pending → 23514';
  end;
  begin
    update public.orders set status = 'paid' where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: paid sin prueba';
  exception when check_violation then
    if sqlerrm <> 'PAID_WITHOUT_PROOF' then raise; end if;
    raise notice 'OK: paid sin transacción ni aprobación → PAID_WITHOUT_PROOF';
  end;
  begin
    update public.orders set status = 'paid', payment_method = 'transfer'
     where id = '00000000-0000-4000-c000-0000000000f1';
    raise exception 'FALLO: paid por transferencia sin approved_by';
  exception when check_violation then raise notice 'OK: transferencia sin approved_by → PAID_WITHOUT_PROOF';
  end;

  perform public.flag_payment_for_review('order', '00000000-0000-4000-c000-0000000000f1', 'qa');
  if not (select requires_review from public.orders where id = '00000000-0000-4000-c000-0000000000f1') then
    raise exception 'FALLO: flag_payment_for_review no marco la orden';
  end if;
  raise notice 'OK: flag_payment_for_review (DEFINER) escribe la orden';

  select stock into v_stock from public.products where id = '00000000-0000-4000-d000-000000000002';
  r := public.confirm_order_payment('00000000-0000-4000-c000-0000000000f1', 'CART-QA-F03', 'tx-qa-f03', 'CARD', 'wompi');
  if (select status from public.orders where id = '00000000-0000-4000-c000-0000000000f1') <> 'paid'
     or (select stock from public.products where id = '00000000-0000-4000-d000-000000000002') <> v_stock - 2 then
    raise exception 'FALLO: confirm_order_payment sobre pending_payment: %', r;
  end if;
  r := public.confirm_order_payment('00000000-0000-4000-c000-0000000000f1', 'CART-QA-F03', 'tx-qa-f03', 'CARD', 'wompi');
  if not coalesce((r->>'idempotent')::boolean, false) then raise exception 'FALLO: confirm no idempotente: %', r; end if;
  raise notice 'OK: confirm_order_payment pending_payment → paid, stock −2, repetido idempotente';

  if (select count(*) from public.order_status_history
       where order_id = '00000000-0000-4000-c000-0000000000f1' and to_status = 'paid'
         and from_status = 'pending_payment' and actor_role = 'webhook') <> 1 then
    raise exception 'FALLO: historial sin la transición pending_payment → paid';
  end if;
  raise notice 'OK: historial registra pending_payment → paid (webhook, M-F0-4)';
end $$;

-- ── Tienda escolar: el admin (no dueño) ve los pedidos; el coach no ──────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.vp_a', public.enable_school_store(current_setting('qa.school_a')::uuid)::text, true);
reset role;
insert into public.orders (id, user_id, total_amount, vendor_profile_id, school_id)
values ('00000000-0000-4000-c000-0000000000f2', current_setting('qa.u_padre')::uuid, 45000,
        current_setting('qa.vp_a')::uuid, current_setting('qa.school_a')::uuid);
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.orders where id = '00000000-0000-4000-c000-0000000000f2') then
    raise exception 'FALLO: el admin de la escuela no ve el pedido de su tienda';
  end if;
  if not exists (select 1 from public.order_status_history where order_id = '00000000-0000-4000-c000-0000000000f2') then
    raise exception 'FALLO: el admin no ve el historial del pedido de su tienda';
  end if;
  raise notice 'OK: el admin de la escuela ve el pedido y su historial';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'coach.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.orders where id = '00000000-0000-4000-c000-0000000000f2') then
    raise exception 'FALLO: el coach ve los pedidos de la tienda';
  end if;
  raise notice 'OK: el coach no ve los pedidos de la tienda';
end $$;

rollback;
