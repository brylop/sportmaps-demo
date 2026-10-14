-- K01c (tienda v2 F3b, mig. 20261013170543) — concurrencia REAL del tope de
-- usos: sesiones abiertas con dblink que COMMITEAN contra el gemelo. Una
-- sesión "compuerta" toma el FOR UPDATE de la fila del cupón; los
-- trabajadores (cada uno comprando un producto DISTINTO, para que lo único que
-- compartan sea el cupón) quedan bloqueados en create_cart_order y se sueltan
-- a la vez con el COMMIT de la compuerta.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/K01c_cupon_concurrencia_ultimo_uso.sql
--
--   K1  dos compradores por el ÚLTIMO uso (max_redemptions 1) → 1 orden con
--       descuento, el otro COUPON_LIMIT; 1 redención.
--   K2  8 compradores sobre max_redemptions 3 → 3 órdenes, 5 COUPON_LIMIT.
--   K3  el MISMO comprador en dos sesiones con max_per_buyer 1 → 1 orden,
--       1 COUPON_BUYER_LIMIT.
--
-- ⚠️ Escribe y commitea en el gemelo (fixture propio con UUID fijos …-0000000000e…
-- y cupones QAK…) y lo borra al final; la limpieza inicial deja en blanco los
-- restos de una corrida fallida. Nunca corre contra la viva (runner solo localhost).

begin;
create extension if not exists dblink schema extensions;

select set_config('qa.cs', format('host=%s port=%s dbname=%s user=postgres password=postgres',
                                  host(inet_server_addr()), current_setting('port'), current_database()), true);
select set_config('qa.vp_ok', (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.cat',   (select category_id::text from public.products where id = '00000000-0000-4000-d000-000000000002'), true);
-- Compradores: los actores QA que haya (la semilla del gemelo trae 10; otros clones pueden quitar algunos).
select set_config('qa.buyers', (select string_agg(user_id::text, ',' order by alias) from qa_twin.actores
                                  where alias <> 'vendedor.ok'), true);
select set_config('qa.store0', (select value::text from public.platform_config where key = 'store_enabled'), true);
select set_config('qa.pay0', coalesce((select row_to_json(s)::text from public.store_payment_settings s
                                        where vendor_profile_id = current_setting('qa.vp_ok')::uuid), ''), true);

select set_config('qa.cleanup', format($c$
  create temp table qa_k_orders on commit drop as
    select distinct order_id as id from public.order_items where product_id::text like '00000000-0000-4000-d000-0000000000e%%';
  delete from public.store_coupon_redemptions where order_id in (select id from qa_k_orders);
  delete from public.stock_holds where order_id in (select id from qa_k_orders);
  delete from public.order_items where order_id in (select id from qa_k_orders);
  delete from public.order_status_history where order_id in (select id from qa_k_orders);
  delete from public.orders where id in (select id from qa_k_orders);
  delete from public.store_coupon_attempts where code_norm like 'QAK%%';
  delete from public.store_coupons where vendor_profile_id = %L and code like 'QAK%%';
  delete from public.products where id::text like '00000000-0000-4000-d000-0000000000e%%';
$c$, current_setting('qa.vp_ok')), true);

do $$
declare
  cs text := current_setting('qa.cs');
  buyers text[] := string_to_array(current_setting('qa.buyers'), ',');
  ok int; lim int; other int;
  r text; e text; i int; n int;
  v_prod text;
begin
  if array_length(buyers, 1) < 8 then
    raise exception 'FALLO: el fixture necesita 8 actores, hay %', array_length(buyers, 1);
  end if;
  perform extensions.dblink_connect('qs', cs);
  perform extensions.dblink_exec('qs', current_setting('qa.cleanup'));

  -- ── Fixture COMMITEADO: 10 productos de 5 unidades + 3 cupones ─────────────
  perform extensions.dblink_exec('qs', format($f$
    update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
    insert into public.store_payment_settings (vendor_profile_id, accept_cash_pickup) values (%1$L, true)
    on conflict (vendor_profile_id) do update set accept_cash_pickup = true;
    insert into public.products (id, vendor_profile_id, name, description, price, stock, tax_rate, category_id, image_url, status, visibility, active)
    select ('00000000-0000-4000-d000-0000000000e' || to_hex(g))::uuid, %1$L, 'QA K cupón ' || g,
           'Producto de prueba de concurrencia de cupones del gemelo local (QA).', 20000, 5, 0.19, %2$L,
           'https://qa.invalid/k.jpg', 'draft', 'public', true
      from generate_series(0, 9) g;
    update public.products set status = 'active' where id::text like '00000000-0000-4000-d000-0000000000e%%';
    insert into public.store_coupons (vendor_profile_id, code, kind, value, max_redemptions, max_per_buyer)
    values (%1$L, 'QAKULTIMO', 'percent', 10, 1, 1),
           (%1$L, 'QAKTRES',   'percent', 10, 3, 1),
           (%1$L, 'QAKUNOXPAPA', 'fixed', 2000, null, 1);
  $f$, current_setting('qa.vp_ok'), current_setting('qa.cat')));

  -- ════ K1: dos compradores por el último uso ═══════════════════════════════
  perform extensions.dblink_connect('gate', cs);
  perform extensions.dblink_exec('gate', 'begin');
  perform * from extensions.dblink('gate', format($q$select id::text from public.store_coupons where vendor_profile_id = %L and code = 'QAKULTIMO' for update$q$, current_setting('qa.vp_ok'))) t(id text);
  for i in 1..2 loop
    v_prod := '00000000-0000-4000-d000-0000000000e' || to_hex(i - 1);
    perform extensions.dblink_connect('w' || i, cs);
    perform extensions.dblink_exec('w' || i, 'set role authenticated');
    perform extensions.dblink_exec('w' || i, format($q$set request.jwt.claims = %L$q$,
                                   json_build_object('sub', buyers[i], 'role', 'authenticated')::text));
    perform extensions.dblink_send_query('w' || i, format($q$select (public.create_cart_order(%L::jsonb, 'pickup', null, null, null, 'cash_pickup', 'qakultimo', null, null))::text$q$,
                                         jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1))::text));
  end loop;
  perform pg_sleep(0.4);
  -- Los dos tienen que estar esperando el candado del cupón (no terminados antes).
  select count(*) into n from pg_stat_activity
   where wait_event_type = 'Lock' and query like '%qakultimo%';
  perform extensions.dblink_exec('gate', 'commit');
  ok := 0; lim := 0; other := 0;
  for i in 1..2 loop
    r := null;
    select t.r into r from extensions.dblink_get_result('w' || i, false) as t(r text);
    e := extensions.dblink_error_message('w' || i);
    perform * from extensions.dblink_get_result('w' || i, false) as t(r text);
    if r is not null then ok := ok + 1;
    elsif e like '%COUPON_LIMIT%' then lim := lim + 1;
    else other := other + 1; raise notice 'K1 w% error: %', i, e; end if;
    perform extensions.dblink_disconnect('w' || i);
  end loop;
  if n <> 2 then raise exception 'FALLO: K1 la barrera no retuvo a las 2 sesiones (esperando=%)', n; end if;
  select count(*) into n from public.store_coupon_redemptions r join public.store_coupons c on c.id = r.coupon_id
   where c.vendor_profile_id = current_setting('qa.vp_ok')::uuid and c.code = 'QAKULTIMO' and r.status = 'reserved';
  if ok <> 1 or lim <> 1 or other <> 0 or n <> 1 then
    raise exception 'FALLO: K1 ok=% COUPON_LIMIT=% otros=% redenciones=%', ok, lim, other, n;
  end if;
  raise notice 'OK: K1 dos sesiones (bloqueadas en el cupón) comitean por el último uso → 1 orden con descuento, 1 COUPON_LIMIT, 1 redención';

  -- ════ K2: 8 compradores sobre 3 usos ═══════════════════════════════════════
  perform extensions.dblink_exec('gate', 'begin');
  perform * from extensions.dblink('gate', format($q$select id::text from public.store_coupons where vendor_profile_id = %L and code = 'QAKTRES' for update$q$, current_setting('qa.vp_ok'))) t(id text);
  for i in 1..8 loop
    v_prod := '00000000-0000-4000-d000-0000000000e' || to_hex(i - 1);
    perform extensions.dblink_connect('w' || i, cs);
    perform extensions.dblink_exec('w' || i, 'set role authenticated');
    perform extensions.dblink_exec('w' || i, format($q$set request.jwt.claims = %L$q$,
                                   json_build_object('sub', buyers[i], 'role', 'authenticated')::text));
    perform extensions.dblink_send_query('w' || i, format($q$select (public.create_cart_order(%L::jsonb, 'pickup', null, null, null, 'cash_pickup', 'QAKTRES', null, null))::text$q$,
                                         jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1))::text));
  end loop;
  perform pg_sleep(0.6);
  perform extensions.dblink_exec('gate', 'commit');
  ok := 0; lim := 0; other := 0;
  for i in 1..8 loop
    r := null;
    select t.r into r from extensions.dblink_get_result('w' || i, false) as t(r text);
    e := extensions.dblink_error_message('w' || i);
    perform * from extensions.dblink_get_result('w' || i, false) as t(r text);
    if r is not null then ok := ok + 1;
    elsif e like '%COUPON_LIMIT%' then lim := lim + 1;
    else other := other + 1; raise notice 'K2 w% error: %', i, e; end if;
    perform extensions.dblink_disconnect('w' || i);
  end loop;
  select count(*) into n from public.store_coupon_redemptions r join public.store_coupons c on c.id = r.coupon_id
   where c.vendor_profile_id = current_setting('qa.vp_ok')::uuid and c.code = 'QAKTRES' and r.status = 'reserved';
  if ok <> 3 or lim <> 5 or other <> 0 or n <> 3 then
    raise exception 'FALLO: K2 ok=% COUPON_LIMIT=% otros=% redenciones=%', ok, lim, other, n;
  end if;
  raise notice 'OK: K2 8 sesiones sobre max_redemptions 3 → 3 órdenes, 5 COUPON_LIMIT, 3 redenciones';

  -- ════ K3: el mismo comprador en dos sesiones (max_per_buyer 1) ═════════════
  perform extensions.dblink_exec('gate', 'begin');
  perform * from extensions.dblink('gate', format($q$select id::text from public.store_coupons where vendor_profile_id = %L and code = 'QAKUNOXPAPA' for update$q$, current_setting('qa.vp_ok'))) t(id text);
  for i in 1..2 loop
    v_prod := '00000000-0000-4000-d000-0000000000e' || to_hex(i + 3);
    perform extensions.dblink_connect('w' || i, cs);
    perform extensions.dblink_exec('w' || i, 'set role authenticated');
    perform extensions.dblink_exec('w' || i, format($q$set request.jwt.claims = %L$q$,
                                   json_build_object('sub', buyers[1], 'role', 'authenticated')::text));
    perform extensions.dblink_send_query('w' || i, format($q$select (public.create_cart_order(%L::jsonb, 'pickup', null, null, null, 'cash_pickup', 'QAKUNOXPAPA', null, null))::text$q$,
                                         jsonb_build_array(jsonb_build_object('product_id', v_prod, 'quantity', 1))::text));
  end loop;
  perform pg_sleep(0.4);
  perform extensions.dblink_exec('gate', 'commit');
  ok := 0; lim := 0; other := 0;
  for i in 1..2 loop
    r := null;
    select t.r into r from extensions.dblink_get_result('w' || i, false) as t(r text);
    e := extensions.dblink_error_message('w' || i);
    perform * from extensions.dblink_get_result('w' || i, false) as t(r text);
    if r is not null then ok := ok + 1;
    elsif e like '%COUPON_BUYER_LIMIT%' then lim := lim + 1;
    else other := other + 1; raise notice 'K3 w% error: %', i, e; end if;
    perform extensions.dblink_disconnect('w' || i);
  end loop;
  if ok <> 1 or lim <> 1 or other <> 0 then
    raise exception 'FALLO: K3 ok=% COUPON_BUYER_LIMIT=% otros=%', ok, lim, other;
  end if;
  raise notice 'OK: K3 el mismo papá en 2 sesiones con max_per_buyer 1 → 1 orden, 1 COUPON_BUYER_LIMIT';

  -- ── Limpieza (también restaura la tienda y los medios del vendedor) ─────────
  perform extensions.dblink_exec('qs', current_setting('qa.cleanup'));
  perform extensions.dblink_exec('qs', format($q$update public.platform_config set value = %L::jsonb where key = 'store_enabled'$q$,
                                              current_setting('qa.store0')));
  if current_setting('qa.pay0') = '' then
    perform extensions.dblink_exec('qs', format($q$delete from public.store_payment_settings where vendor_profile_id = %L$q$, current_setting('qa.vp_ok')));
  end if;
  perform extensions.dblink_disconnect('gate');
  perform extensions.dblink_disconnect('qs');
end $$;

rollback;
