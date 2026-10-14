-- I01d (compra sin cuenta, mig. 20261013170553) — los productos school_only
-- (y private) NO se compran sin cuenta: LOGIN_REQUIRED, por variante o por
-- producto, solos o mezclados con uno público, y no queda nada reservado.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/I01d_school_only_bloqueado.sql
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

select set_config('qa.res_m0', (select reserved::text from public.product_variants where id = '00000000-0000-4000-e000-000000000002'), true);
select set_config('qa.res_p0', (select reserved::text from public.products where id = '00000000-0000-4000-d000-00000000f101'), true);

select pg_temp.como_bff();
set local role service_role;
do $$
declare items jsonb;
begin
  if (select visibility::text from public.products where id = '00000000-0000-4000-d000-000000000001') <> 'school_only' then
    raise exception 'FALLO (fixture): la camiseta del seed no es school_only';
  end if;
  foreach items in array array[
      jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-4000-e000-000000000002', 'quantity', 1)),
      jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-4000-d000-000000000001', 'quantity', 1)),
      pg_temp.carrito() || jsonb_build_array(jsonb_build_object('variant_id', '00000000-0000-4000-e000-000000000002', 'quantity', 1))
  ] loop
    begin
      perform public.create_guest_cart_order(items, 'pickup', null, null, pg_temp.comprador('socio@qa.test'), 'transfer', null, gen_random_uuid(), null);
      raise exception 'FALLO: invitado compró un producto school_only: %', items;
    exception when others then
      if sqlerrm <> 'LOGIN_REQUIRED' then raise; end if;
    end;
  end loop;
  raise notice 'OK: school_only por variante, por producto y mezclado con uno público → LOGIN_REQUIRED';

  update public.products set visibility = 'private' where id = '00000000-0000-4000-d000-00000000f101';
  begin
    perform public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('socio@qa.test'), 'transfer', null, gen_random_uuid(), null);
    raise exception 'FALLO: invitado compró un producto private';
  exception when others then
    if sqlerrm <> 'LOGIN_REQUIRED' then raise; end if;
  end;
  update public.products set visibility = 'public' where id = '00000000-0000-4000-d000-00000000f101';
  raise notice 'OK: private → LOGIN_REQUIRED';

  if (select reserved from public.product_variants where id = '00000000-0000-4000-e000-000000000002') <> current_setting('qa.res_m0')::int
     or (select reserved from public.products where id = '00000000-0000-4000-d000-00000000f101') <> current_setting('qa.res_p0')::int
     or exists (select 1 from public.orders where guest_email = 'socio@qa.test')
     or exists (select 1 from public.store_guest_checkout_log) then
    raise exception 'FALLO: quedaron reservas, órdenes o rastro de un intento rechazado';
  end if;
  raise notice 'OK: sin reservas, órdenes ni rastro de los intentos rechazados';
end $$;
reset role;

rollback;
