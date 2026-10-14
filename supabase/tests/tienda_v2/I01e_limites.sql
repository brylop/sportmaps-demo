-- I01e (compra sin cuenta, mig. 20261013170553) — límites anti-abuso y
-- validación de datos (configurables en platform_config 'store_guest_checkout'):
--   · pedidos por correo por hora (3) → GUEST_RATE_LIMITED scope email;
--   · pedidos por IP por hora (con otros correos) → GUEST_RATE_LIMITED scope ip;
--   · pedidos sin pagar abiertos por correo → GUEST_OPEN_ORDERS_LIMIT;
--   · monto máximo del invitado → GUEST_AMOUNT_LIMIT y NO queda reserva;
--   · apagado → GUEST_CHECKOUT_DISABLED;
--   · correo/nombre obligatorios, teléfono válido, idempotency key obligatoria.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/I01e_limites.sql
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

create or replace function pg_temp.cfg(p jsonb) returns void language sql as $$
  update public.platform_config set value = value || p where key = 'store_guest_checkout';
$$;
create or replace function pg_temp.intento(p_email text, p_ip text, p_qty int default 1, p_buyer jsonb default null,
                                           p_key uuid default gen_random_uuid()) returns text
language plpgsql as $$
begin
  perform public.create_guest_cart_order(pg_temp.carrito(p_qty), 'pickup', null, null,
            coalesce(p_buyer, pg_temp.comprador(p_email)), 'transfer', null, p_key, p_ip);
  return 'OK';
exception when others then
  return sqlerrm;
end $$;

select pg_temp.como_bff();
set local role service_role;
do $$
declare s text; i int; res0 int;
begin
  -- 1. Por correo: 3 por hora (aunque cambie la IP y las mayúsculas).
  for i in 1..3 loop
    s := pg_temp.intento(case i when 2 then 'REPE@qa.test' else 'repe@qa.test' end, '10.1.0.' || i);
    if s <> 'OK' then raise exception 'FALLO: intento % del mismo correo: %', i, s; end if;
  end loop;
  s := pg_temp.intento('repe@qa.test', '10.1.0.9');
  if s <> 'GUEST_RATE_LIMITED' then raise exception 'FALLO: 4.º pedido del mismo correo en la hora: %', s; end if;
  raise notice 'OK: 3 pedidos por correo por hora (sin importar mayúsculas ni IP); el 4.º → GUEST_RATE_LIMITED';

  -- 2. Por IP: con otros correos.
  perform pg_temp.cfg('{"max_orders_per_ip_hour": 2}');
  s := pg_temp.intento('ip1@qa.test', '200.1.1.1');
  if s <> 'OK' then raise exception 'FALLO: ip 1: %', s; end if;
  s := pg_temp.intento('ip2@qa.test', '200.1.1.1');
  if s <> 'OK' then raise exception 'FALLO: ip 2: %', s; end if;
  s := pg_temp.intento('ip3@qa.test', '200.1.1.1');
  if s <> 'GUEST_RATE_LIMITED' then raise exception 'FALLO: 3.er pedido desde la misma IP: %', s; end if;
  s := pg_temp.intento('ip3@qa.test', '200.1.1.2');
  if s <> 'OK' then raise exception 'FALLO: otra IP debería pasar: %', s; end if;
  raise notice 'OK: límite por IP con correos distintos → GUEST_RATE_LIMITED; otra IP pasa';
  perform pg_temp.cfg('{"max_orders_per_ip_hour": 10}');

  -- 3. Pedidos abiertos (sin pagar) por correo, con el límite por hora holgado.
  perform pg_temp.cfg('{"max_orders_per_email_hour": 20, "max_open_orders_per_email": 2}');
  s := pg_temp.intento('abiertos@qa.test', null);
  s := s || pg_temp.intento('abiertos@qa.test', null);
  if s <> 'OKOK' then raise exception 'FALLO: abiertos 1-2: %', s; end if;
  s := pg_temp.intento('abiertos@qa.test', null);
  if s <> 'GUEST_OPEN_ORDERS_LIMIT' then raise exception 'FALLO: 3.er pedido abierto: %', s; end if;
  update public.orders set status = 'cancelled' where guest_email = 'abiertos@qa.test'
     and id = (select id from public.orders where guest_email = 'abiertos@qa.test' order by created_at limit 1);
  s := pg_temp.intento('abiertos@qa.test', null);
  if s <> 'OK' then raise exception 'FALLO: con uno cerrado debería pasar: %', s; end if;
  raise notice 'OK: máximo de pedidos sin pagar por correo → GUEST_OPEN_ORDERS_LIMIT; al cerrar uno, pasa';

  -- 4. Monto máximo: 3 × 40.000 = 120.000 > 100.000; nada queda reservado.
  perform pg_temp.cfg('{"max_order_amount": 100000}');
  select reserved into res0 from public.products where id = '00000000-0000-4000-d000-00000000f101';
  s := pg_temp.intento('monto@qa.test', null, 3);
  if s <> 'GUEST_AMOUNT_LIMIT' then raise exception 'FALLO: monto: %', s; end if;
  if (select reserved from public.products where id = '00000000-0000-4000-d000-00000000f101') <> res0
     or exists (select 1 from public.orders where guest_email = 'monto@qa.test') then
    raise exception 'FALLO: el pedido por encima del monto dejó orden o reserva';
  end if;
  s := pg_temp.intento('monto@qa.test', null, 2);
  if s <> 'OK' then raise exception 'FALLO: 80.000 debería pasar: %', s; end if;
  raise notice 'OK: monto máximo del invitado → GUEST_AMOUNT_LIMIT, sin orden ni reserva; por debajo pasa';

  -- 5. Datos.
  if pg_temp.intento(null, null, 1, '{"name":"Sin Correo"}') <> 'GUEST_EMAIL_REQUIRED'
     or pg_temp.intento(null, null, 1, '{"email":"no-es-correo","name":"X Y"}') <> 'GUEST_EMAIL_REQUIRED'
     or pg_temp.intento(null, null, 1, '{"email":"a@b","name":"X Y"}') <> 'GUEST_EMAIL_REQUIRED'
     or pg_temp.intento(null, null, 1, '{"email":"nombre@qa.test"}') <> 'GUEST_NAME_REQUIRED'
     or pg_temp.intento(null, null, 1, '{"email":"nombre@qa.test","name":" a "}') <> 'GUEST_NAME_REQUIRED'
     or pg_temp.intento(null, null, 1, '{"email":"tel@qa.test","name":"Con Tel","phone":"12ab"}') <> 'INVALID_PHONE' then
    raise exception 'FALLO: validación de datos del comprador';
  end if;
  begin
    perform public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('key@qa.test'), 'transfer', null, null, null);
    raise exception 'FALLO: sin idempotency key';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_REQUIRED' then raise; end if;
  end;
  raise notice 'OK: correo y nombre obligatorios, teléfono válido, idempotency key obligatoria';

  -- 6. Apagado.
  perform pg_temp.cfg('{"enabled": false}');
  s := pg_temp.intento('apagado@qa.test', null);
  if s <> 'GUEST_CHECKOUT_DISABLED' then raise exception 'FALLO: apagado: %', s; end if;
  raise notice 'OK: compra sin cuenta apagada → GUEST_CHECKOUT_DISABLED';
end $$;
reset role;

rollback;
