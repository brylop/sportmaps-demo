-- I01a (compra sin cuenta, mig. 20261013170553) — NADIE crea órdenes de invitado
-- por PostgREST: ni anon ni authenticated. Solo el BFF (service role).
--   · anon: INSERT en orders, create_cart_order, create_guest_cart_order y las RPC
--     por token → 42501; no lee orders ni store_guest_checkout_log.
--   · authenticated: tampoco ejecuta las RPC de invitado; con create_cart_order
--     el comprador sigue siendo auth.uid() aunque mande p_buyer_id NULL y ponga
--     la marca de invitado a mano.
--   · service role SIN pasar por create_guest_cart_order: comprador NULL →
--     NOT_AUTHENTICATED.
--   · Permisos y search_path de todas las funciones nuevas.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/I01a_anon_no_crea_ordenes.sql
begin;
-- ── Fixture común I01 (todo dentro de la transacción del caso) ──────────────
select set_config('sportmaps.trusted_rpc', 'on', true);
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
insert into public.platform_config (key, value)
values ('store_guest_checkout', '{"enabled": true, "max_order_amount": 1000000, "max_orders_per_email_hour": 3, "max_orders_per_ip_hour": 10, "max_open_orders_per_email": 3, "token_ttl_days": 180}'::jsonb)
on conflict (key) do update set value = excluded.value;
-- Línea base: el log de límites arranca vacío en esta transacción.
delete from public.store_guest_checkout_log;
select set_config('qa.u_owner', (select user_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.u_admin', (select user_id::text from qa_twin.actores where alias = 'admin.a'), true);
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.vp_a', public.enable_school_store(current_setting('qa.school_a')::uuid)::text, true);
reset role;
insert into public.school_settings (school_id, payment_accounts)
values (current_setting('qa.school_a')::uuid,
        '[{"id":"qi1","type":"bank","label":"Bancolombia ahorros","value":"000-QA-INVITADO","bank":"Bancolombia","account_type":"ahorros","holder":"QA Academia Andes","active":true}]'::jsonb)
on conflict (school_id) do update set payment_accounts = excluded.payment_accounts;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
         '{"accept_transfer":true,"accept_cash_pickup":true,"transfer_instructions":"Escribe la referencia"}'::jsonb, null);
reset role;
select set_config('request.jwt.claims', null, true);
-- Producto público (sin variantes, 20 unidades, $40.000) y la camiseta school_only del seed en la tienda.
insert into public.products (id, vendor_id, vendor_profile_id, school_id, name, description, price, stock, image_url,
                             visibility, status, active, category_id, tax_rate, sku)
values ('00000000-0000-4000-d000-00000000f101', current_setting('qa.u_owner')::uuid, current_setting('qa.vp_a')::uuid,
        current_setting('qa.school_a')::uuid, 'QA Invitado Shaker',
        'Producto sintetico para los casos de compra sin cuenta (gemelo local).', 40000, 20,
        'https://placehold.co/800x800.png?text=QA', 'public', 'draft', true,
        (select id from public.product_categories order by sort_order nulls last, id limit 1), 0.19, 'QA-INV-SHAKER')
on conflict (id) do update set stock = 20, reserved = 0, price = 40000, visibility = 'public', vendor_profile_id = excluded.vendor_profile_id;
update public.products set status = 'active' where id = '00000000-0000-4000-d000-00000000f101' and status <> 'active';
update public.products set vendor_profile_id = current_setting('qa.vp_a')::uuid where id = '00000000-0000-4000-d000-000000000001';
-- Helper: actuar como el BFF (service role).
create or replace function pg_temp.como_bff() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;
create or replace function pg_temp.carrito(p_qty int default 1) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-d000-00000000f101', 'quantity', p_qty));
$$;
create or replace function pg_temp.comprador(p_email text, p_name text default 'Socio Sin Cuenta', p_phone text default '3001234567') returns jsonb language sql as $$
  select jsonb_build_object('email', p_email, 'name', p_name, 'phone', p_phone);
$$;
-- ── fin fixture ─────────────────────────────────────────────────────────────

-- ── anon ─────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
declare n int;
begin
  begin
    insert into public.orders (user_id, total_amount, status, guest_email) values (null, 1000, 'pending_payment', 'x@y.co');
    raise exception 'FALLO: anon inserta una orden';
  exception when insufficient_privilege then raise notice 'OK: anon INSERT orders → 42501';
  end;
  begin
    perform public.create_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('anon@qa.test'), 'transfer', null, null, gen_random_uuid());
    raise exception 'FALLO: anon ejecuta create_cart_order';
  exception when insufficient_privilege then raise notice 'OK: anon create_cart_order → 42501';
  end;
  begin
    perform public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('anon@qa.test'), 'transfer', null, gen_random_uuid(), '1.2.3.4');
    raise exception 'FALLO: anon ejecuta create_guest_cart_order';
  exception when insufficient_privilege then raise notice 'OK: anon create_guest_cart_order → 42501';
  end;
  begin
    perform public.guest_order_view(repeat('a', 64));
    raise exception 'FALLO: anon ejecuta guest_order_view';
  exception when insufficient_privilege then raise notice 'OK: anon guest_order_view → 42501';
  end;
  begin
    perform public.guest_order_submit_receipt(repeat('a', 64), 'x/y.png');
    raise exception 'FALLO: anon ejecuta guest_order_submit_receipt';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.guest_order_regenerate_pickup_code(repeat('a', 64));
    raise exception 'FALLO: anon ejecuta guest_order_regenerate_pickup_code';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.guest_order_cancel(repeat('a', 64), null);
    raise exception 'FALLO: anon ejecuta guest_order_cancel';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.link_my_guest_orders();
    raise exception 'FALLO: anon ejecuta link_my_guest_orders';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: anon no ejecuta ninguna RPC por token ni link_my_guest_orders (42501)';
  begin
    select count(*) into n from public.orders;
    raise exception 'FALLO: anon lee orders (% filas)', n;
  exception when insufficient_privilege then raise notice 'OK: anon no lee orders';
  end;
  begin
    select count(*) into n from public.store_guest_checkout_log;
    raise exception 'FALLO: anon lee store_guest_checkout_log';
  exception when insufficient_privilege then raise notice 'OK: anon no lee store_guest_checkout_log';
  end;
end $$;
reset role;

-- ── authenticated (padre.a) ──────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; n int;
begin
  begin
    perform public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('auth@qa.test'), 'transfer', null, gen_random_uuid(), null);
    raise exception 'FALLO: authenticated ejecuta create_guest_cart_order';
  exception when insufficient_privilege then raise notice 'OK: authenticated create_guest_cart_order → 42501';
  end;
  begin
    perform public.guest_order_view(repeat('a', 64));
    raise exception 'FALLO: authenticated ejecuta guest_order_view';
  exception when insufficient_privilege then raise notice 'OK: authenticated guest_order_view → 42501';
  end;
  -- La marca de invitado puesta a mano no sirve: con JWT el comprador es auth.uid().
  perform set_config('sportmaps.guest_checkout', 'on', true);
  r := public.create_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('otro@qa.test'), 'transfer', null, null, gen_random_uuid());
  perform set_config('sportmaps.guest_checkout', 'off', true);
  if (select user_id from public.orders where id = (r->>'order_id')::uuid) is distinct from auth.uid() then
    raise exception 'FALLO: con JWT la orden no quedó del usuario: %', r;
  end if;
  if (select guest_token_hash from public.orders where id = (r->>'order_id')::uuid) is not null then
    raise exception 'FALLO: una orden con cuenta quedó con token de invitado';
  end if;
  raise notice 'OK: con JWT, p_buyer_id NULL + marca de invitado → la orden es de auth.uid(), sin token';
  begin
    select count(*) into n from public.store_guest_checkout_log;
    raise exception 'FALLO: authenticated lee store_guest_checkout_log';
  exception when insufficient_privilege then raise notice 'OK: authenticated no lee store_guest_checkout_log';
  end;
end $$;
reset role;

-- ── service role por fuera del flujo de invitado ─────────────────────────────
select pg_temp.como_bff();
set local role service_role;
do $$
begin
  begin
    perform public.create_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('bff@qa.test'), 'transfer', null, null, gen_random_uuid());
    raise exception 'FALLO: service role creó una orden sin comprador y sin pasar por create_guest_cart_order';
  exception when insufficient_privilege then
    if sqlerrm <> 'NOT_AUTHENTICATED' then raise; end if;
    raise notice 'OK: service role con comprador NULL fuera del flujo de invitado → NOT_AUTHENTICATED';
  end;
end $$;
reset role;

-- ── Permisos de lo nuevo ─────────────────────────────────────────────────────
do $$
declare v text;
begin
  select string_agg(p.oid::regprocedure::text, ', ') into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_guest_cart_order','guest_order_view','guest_order_submit_receipt','guest_order_regenerate_pickup_code',
                       'guest_order_cancel','_store_guest_order_id','_store_link_guest_orders','_store_guest_config',
                       '_store_guest_cfg_int','fn_store_link_guest_orders_on_confirm')
     and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v is not null then raise exception 'FALLO: ejecutables por anon/authenticated: %', v; end if;
  if has_function_privilege('anon', 'public.link_my_guest_orders()', 'EXECUTE') then
    raise exception 'FALLO: anon ejecuta link_my_guest_orders';
  end if;
  if exists (select 1 from pg_policies where tablename = 'store_guest_checkout_log') then
    raise exception 'FALLO: store_guest_checkout_log tiene policies';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.store_guest_checkout_log'::regclass) then
    raise exception 'FALLO: store_guest_checkout_log sin RLS';
  end if;
  if has_table_privilege('anon', 'public.store_guest_checkout_log', 'SELECT')
     or has_table_privilege('authenticated', 'public.store_guest_checkout_log', 'SELECT') then
    raise exception 'FALLO: grants de lectura en store_guest_checkout_log';
  end if;
  select string_agg(p.proname, ', ') into v
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_guest_cart_order','guest_order_view','guest_order_submit_receipt',
                       'guest_order_regenerate_pickup_code','guest_order_cancel','link_my_guest_orders',
                       '_store_link_guest_orders','fn_store_link_guest_orders_on_confirm','_store_guest_order_id',
                       '_store_guest_config','_store_guest_cfg_int','create_cart_order')
     and not coalesce(array_to_string(p.proconfig, ',') like '%search_path=pg_catalog, public, pg_temp%', false);
  if v is not null then raise exception 'FALLO: funciones sin search_path fijo: %', v; end if;
  raise notice 'OK: todo service_role (link_my_guest_orders → authenticated), log con RLS sin policies ni grants, search_path fijo';
end $$;

rollback;
