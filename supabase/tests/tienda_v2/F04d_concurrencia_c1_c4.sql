-- M-F0-4 (tienda v2 F0) — concurrencia REAL (§8.3): varias sesiones que
-- COMMITEAN contra el gemelo, abiertas con dblink. Una sesión "compuerta"
-- toma el FOR UPDATE de las filas en juego; todos los trabajadores quedan
-- bloqueados en el mismo punto y se sueltan a la vez al hacer COMMIT de la
-- compuerta (barrera).
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F04d_concurrencia_c1_c4.sql
--
--   C1  dos compradores por el ÚLTIMO ítem → 1 orden, el otro INSUFFICIENT_STOCK;
--       stock 1, reserved 1.
--   C2  20 compradores sobre 10 unidades (escalado de 50/10) → 10 órdenes,
--       Σ holds = 10, ninguna negativa.
--   C3  dos carritos con las mismas 2 variantes en orden inverso → sin
--       deadlock (FOR UPDATE ordenado por id), ambos resuelven.
--   C4  webhook duplicado concurrente del mismo pago → un solo descuento,
--       un kardex, un settlement, un evento contable.
--
-- ⚠️ A diferencia del resto de casos, este ESCRIBE y commitea en el gemelo
-- (fixture propio con UUID fijos …-c0…) y lo borra al final. Si falla a mitad,
-- la limpieza inicial de la siguiente corrida lo deja en blanco. Nunca corre
-- contra la viva (el runner solo acepta localhost).

begin;
create extension if not exists dblink schema extensions;

select set_config('qa.cs', format('host=%s port=%s dbname=%s user=postgres password=postgres',
                                  host(inet_server_addr()), current_setting('port'), current_database()), true);
select set_config('qa.vp_ok',  (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.u_vend', (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.cat',    (select category_id::text from public.products where id = '00000000-0000-4000-d000-000000000002'), true);
select set_config('qa.buyers', (select string_agg(user_id::text, ',') from qa_twin.actores
                                  where alias in ('padre.a','padre.b','atleta.a','owner.b','coach.a')), true);

select set_config('qa.cleanup', format($c$
  create temp table qa_c_orders on commit drop as
    select distinct order_id as id from public.order_items where product_id::text like '00000000-0000-4000-d000-0000000000c%%';
  delete from public.accounting_outbox where source_id in (select id from qa_c_orders);
  delete from public.settlements where order_id in (select id from qa_c_orders);
  delete from public.stock_holds where order_id in (select id from qa_c_orders);
  delete from public.order_items where order_id in (select id from qa_c_orders);
  delete from public.orders where id in (select id from qa_c_orders);
  delete from public.products where id::text like '00000000-0000-4000-d000-0000000000c%%';
  delete from public.vendor_payment_providers where id = '00000000-0000-4000-9000-0000000000c4';
  delete from public.store_payment_settings where vendor_profile_id = %L;
  update public.platform_config set value = '{"enabled": false}'::jsonb where key = 'store_enabled';
$c$, current_setting('qa.vp_ok')), true);

do $$
declare
  cs text := current_setting('qa.cs');
  buyers text[] := string_to_array(current_setting('qa.buyers'), ',');
  ok int; fails int; other int; dead int;
  r text; e text; i int; n int;
  v_order uuid;
  bal0 record;
begin
  perform extensions.dblink_connect('qs', cs);
  perform extensions.dblink_exec('qs', current_setting('qa.cleanup'));   -- restos de una corrida fallida
  select * into bal0 from public.vendor_balances where vendor_profile_id = current_setting('qa.vp_ok')::uuid;

  -- ── Fixture COMMITEADO ────────────────────────────────────────────────────
  perform extensions.dblink_exec('qs', format($f$
    update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
    insert into public.products (id, vendor_profile_id, name, description, price, stock, tax_rate, category_id, image_url, status, visibility, active)
    select x.id::uuid, %1$L, x.name, 'Producto de prueba de concurrencia del gemelo local (QA).', 10000, x.stock, 0.19, %2$L, 'https://qa.invalid/x.jpg', 'draft', 'public', true
      from (values ('00000000-0000-4000-d000-0000000000c1','QA C1 ultimo item',1),
                   ('00000000-0000-4000-d000-0000000000c2','QA C2 diez unidades',10),
                   ('00000000-0000-4000-d000-0000000000c3','QA C3 producto X',5),
                   ('00000000-0000-4000-d000-0000000000c5','QA C3 producto Y',5),
                   ('00000000-0000-4000-d000-0000000000c4','QA C4 webhook',5)) x(id, name, stock);
    update public.products set status = 'active' where id::text like '00000000-0000-4000-d000-0000000000c%%';
    insert into public.vendor_payment_providers (id, vendor_id, provider, public_key, sandbox, is_default, enabled)
    values ('00000000-0000-4000-9000-0000000000c4', %3$L, 'wompi', 'pub_test_QA_C4', true, true, true);
    insert into public.vendor_payment_provider_secrets (provider_id, private_key_enc, integrity_secret_enc)
    values ('00000000-0000-4000-9000-0000000000c4', 'gcm:qa', 'gcm:qa');
    insert into public.store_payment_settings (vendor_profile_id, accept_wompi, accept_cash_pickup)
    values (%1$L, true, true)
    on conflict (vendor_profile_id) do update set accept_wompi = true, accept_cash_pickup = true;
  $f$, current_setting('qa.vp_ok'), current_setting('qa.cat'), current_setting('qa.u_vend')));

  -- ════ C1: el último ítem ═══════════════════════════════════════════════════
  perform extensions.dblink_connect('gate', cs);
  perform extensions.dblink_exec('gate', 'begin');
  perform * from extensions.dblink('gate', $q$select id::text from public.products where id = '00000000-0000-4000-d000-0000000000c1' for update$q$) t(id text);
  for i in 1..2 loop
    perform extensions.dblink_connect('w' || i, cs);
    perform extensions.dblink_exec('w' || i, 'set role authenticated');
    perform extensions.dblink_exec('w' || i, format($q$set request.jwt.claims = %L$q$,
                                   json_build_object('sub', buyers[i], 'role', 'authenticated')::text));
    perform extensions.dblink_send_query('w' || i, $q$select (public.create_cart_order('[{"product_id":"00000000-0000-4000-d000-0000000000c1","quantity":1}]'::jsonb, 'pickup', null, null, null, 'cash_pickup', null, null, null))::text$q$);
  end loop;
  perform pg_sleep(0.3);
  perform extensions.dblink_exec('gate', 'commit');
  ok := 0; fails := 0; other := 0;
  for i in 1..2 loop
    r := null;
    select t.r into r from extensions.dblink_get_result('w' || i, false) as t(r text);
    e := extensions.dblink_error_message('w' || i);
    perform * from extensions.dblink_get_result('w' || i, false) as t(r text);
    if r is not null then ok := ok + 1;
    elsif e like '%INSUFFICIENT_STOCK%' then fails := fails + 1;
    else other := other + 1; raise notice 'C1 w% error: %', i, e; end if;
    perform extensions.dblink_disconnect('w' || i);
  end loop;
  if ok <> 1 or fails <> 1 or other <> 0
     or (select stock from public.products where id = '00000000-0000-4000-d000-0000000000c1') <> 1
     or (select reserved from public.products where id = '00000000-0000-4000-d000-0000000000c1') <> 1 then
    raise exception 'FALLO: C1 ok=% insuf=% otros=%', ok, fails, other;
  end if;
  raise notice 'OK: C1 dos sesiones por el último ítem → 1 orden, 1 INSUFFICIENT_STOCK; stock 1, reserved 1';

  -- ════ C2: 20 sobre 10 ══════════════════════════════════════════════════════
  perform extensions.dblink_exec('gate', 'begin');
  perform * from extensions.dblink('gate', $q$select id::text from public.products where id = '00000000-0000-4000-d000-0000000000c2' for update$q$) t(id text);
  for i in 1..20 loop
    perform extensions.dblink_connect('w' || i, cs);
    perform extensions.dblink_exec('w' || i, 'set role authenticated');
    perform extensions.dblink_exec('w' || i, format($q$set request.jwt.claims = %L$q$,
                                   json_build_object('sub', buyers[1 + (i % array_length(buyers, 1))], 'role', 'authenticated')::text));
    perform extensions.dblink_send_query('w' || i, $q$select (public.create_cart_order('[{"product_id":"00000000-0000-4000-d000-0000000000c2","quantity":1}]'::jsonb, 'pickup', null, null, null, 'cash_pickup', null, null, null))::text$q$);
  end loop;
  perform pg_sleep(0.5);
  perform extensions.dblink_exec('gate', 'commit');
  ok := 0; fails := 0; other := 0;
  for i in 1..20 loop
    r := null;
    select t.r into r from extensions.dblink_get_result('w' || i, false) as t(r text);
    e := extensions.dblink_error_message('w' || i);
    perform * from extensions.dblink_get_result('w' || i, false) as t(r text);
    if r is not null then ok := ok + 1;
    elsif e like '%INSUFFICIENT_STOCK%' then fails := fails + 1;
    else other := other + 1; raise notice 'C2 w% error: %', i, e; end if;
    perform extensions.dblink_disconnect('w' || i);
  end loop;
  select coalesce(sum(quantity), 0) into n from public.stock_holds
   where product_id = '00000000-0000-4000-d000-0000000000c2' and status = 'active';
  if ok <> 10 or fails <> 10 or other <> 0 or n <> 10
     or (select reserved from public.products where id = '00000000-0000-4000-d000-0000000000c2') <> 10
     or (select stock - reserved from public.products where id = '00000000-0000-4000-d000-0000000000c2') <> 0 then
    raise exception 'FALLO: C2 ok=% insuf=% otros=% holds=%', ok, fails, other, n;
  end if;
  raise notice 'OK: C2 20 sesiones sobre 10 unidades → 10 órdenes, 10 INSUFFICIENT_STOCK, Σ holds = reserved = 10, disponible 0';

  -- ════ C3: mismo par de productos en orden inverso ═════════════════════════
  perform extensions.dblink_exec('gate', 'begin');
  perform * from extensions.dblink('gate', $q$select id::text from public.products where id in ('00000000-0000-4000-d000-0000000000c3','00000000-0000-4000-d000-0000000000c5') order by id for update$q$) t(id text);
  for i in 1..2 loop
    perform extensions.dblink_connect('w' || i, cs);
    perform extensions.dblink_exec('w' || i, 'set role authenticated');
    perform extensions.dblink_exec('w' || i, format($q$set request.jwt.claims = %L$q$,
                                   json_build_object('sub', buyers[i], 'role', 'authenticated')::text));
  end loop;
  perform extensions.dblink_send_query('w1', $q$select (public.create_cart_order('[{"product_id":"00000000-0000-4000-d000-0000000000c3","quantity":2},{"product_id":"00000000-0000-4000-d000-0000000000c5","quantity":2}]'::jsonb, 'pickup', null, null, null, 'cash_pickup', null, null, null))::text$q$);
  perform extensions.dblink_send_query('w2', $q$select (public.create_cart_order('[{"product_id":"00000000-0000-4000-d000-0000000000c5","quantity":2},{"product_id":"00000000-0000-4000-d000-0000000000c3","quantity":2}]'::jsonb, 'pickup', null, null, null, 'cash_pickup', null, null, null))::text$q$);
  perform pg_sleep(0.3);
  perform extensions.dblink_exec('gate', 'commit');
  ok := 0; dead := 0; other := 0;
  for i in 1..2 loop
    r := null;
    select t.r into r from extensions.dblink_get_result('w' || i, false) as t(r text);
    e := extensions.dblink_error_message('w' || i);
    perform * from extensions.dblink_get_result('w' || i, false) as t(r text);
    if r is not null then ok := ok + 1;
    elsif e ilike '%deadlock%' then dead := dead + 1;
    else other := other + 1; raise notice 'C3 w% error: %', i, e; end if;
    perform extensions.dblink_disconnect('w' || i);
  end loop;
  if ok <> 2 or dead <> 0 or other <> 0
     or (select reserved from public.products where id = '00000000-0000-4000-d000-0000000000c3') <> 4
     or (select reserved from public.products where id = '00000000-0000-4000-d000-0000000000c5') <> 4 then
    raise exception 'FALLO: C3 ok=% deadlocks=% otros=%', ok, dead, other;
  end if;
  raise notice 'OK: C3 carritos [X,Y] y [Y,X] concurrentes → ambos resuelven, 0 deadlocks';

  -- ════ C4: webhook duplicado concurrente ═══════════════════════════════════
  perform extensions.dblink_connect('w1', cs);
  perform extensions.dblink_exec('w1', 'set role authenticated');
  perform extensions.dblink_exec('w1', format($q$set request.jwt.claims = %L$q$,
                                 json_build_object('sub', buyers[1], 'role', 'authenticated')::text));
  select (t.r::jsonb ->> 'order_id')::uuid into v_order
    from extensions.dblink('w1', $q$select (public.create_cart_order('[{"product_id":"00000000-0000-4000-d000-0000000000c4","quantity":2}]'::jsonb, 'pickup', null, null, null, 'wompi', null, null, null))::text$q$) t(r text);
  perform extensions.dblink_disconnect('w1');

  perform extensions.dblink_exec('gate', 'begin');
  perform * from extensions.dblink('gate', format($q$select id::text from public.orders where id = %L for update$q$, v_order)) t(id text);
  for i in 1..2 loop
    perform extensions.dblink_connect('w' || i, cs);
    perform extensions.dblink_exec('w' || i, 'set role service_role');
    perform extensions.dblink_exec('w' || i, $q$set request.jwt.claims = '{"role":"service_role"}'$q$);
    perform extensions.dblink_send_query('w' || i, format($q$select public.confirm_order_payment(%L, 'ref', 'tx-QA-C4', 'CARD', 'wompi')::text$q$, v_order));
  end loop;
  perform pg_sleep(0.3);
  perform extensions.dblink_exec('gate', 'commit');
  ok := 0; other := 0; n := 0;
  for i in 1..2 loop
    r := null;
    select t.r into r from extensions.dblink_get_result('w' || i, false) as t(r text);
    e := extensions.dblink_error_message('w' || i);
    perform * from extensions.dblink_get_result('w' || i, false) as t(r text);
    if r is null then other := other + 1; raise notice 'C4 w% error: %', i, e;
    elsif coalesce((r::jsonb ->> 'idempotent')::boolean, false) then n := n + 1;
    elsif (r::jsonb ->> 'ok')::boolean then ok := ok + 1;
    else other := other + 1; raise notice 'C4 w% resultado: %', i, r; end if;
    perform extensions.dblink_disconnect('w' || i);
  end loop;
  perform extensions.dblink_disconnect('gate');
  if ok <> 1 or n <> 1 or other <> 0
     or (select stock from public.products where id = '00000000-0000-4000-d000-0000000000c4') <> 3
     or (select reserved from public.products where id = '00000000-0000-4000-d000-0000000000c4') <> 0
     or (select count(*) from public.inventory_logs where order_id = v_order and reason = 'order_paid') <> 1
     or (select count(*) from public.settlements where order_id = v_order) <> 1
     or (select count(*) from public.accounting_outbox where source_id = v_order and event_kind = 'commerce_sale') <> 1 then
    raise exception 'FALLO: C4 ok=% idempotentes=% otros=%', ok, n, other;
  end if;
  raise notice 'OK: C4 dos webhooks simultáneos → 1 pago + 1 idempotente; stock 5→3 una vez, 1 kardex, 1 settlement, 1 commerce_sale';

  -- ── Limpieza (commiteada) ──────────────────────────────────────────────────
  perform extensions.dblink_exec('qs', current_setting('qa.cleanup'));
  perform extensions.dblink_exec('qs', format($q$update public.vendor_balances
       set commission_due = %s, total_earned = %s, total_fees = %s, pending_balance = %s, available_balance = %s
     where vendor_profile_id = %L$q$,
     coalesce(bal0.commission_due, 0), coalesce(bal0.total_earned, 0), coalesce(bal0.total_fees, 0),
     coalesce(bal0.pending_balance, 0), coalesce(bal0.available_balance, 0), current_setting('qa.vp_ok')));
  perform extensions.dblink_disconnect('qs');
  raise notice 'OK: fixture de concurrencia borrado y saldos restaurados';
end $$;

rollback;
