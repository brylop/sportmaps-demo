-- I01c (compra sin cuenta, mig. 20261013170553) — un token solo abre SU pedido.
--   · token inventado, mal formado, en mayúsculas o vacío → NOT_FOUND;
--   · con el token del pedido A no se sube comprobante a la carpeta de B ni se
--     regenera/cancela B;
--   · el hash de un token NO sirve como token;
--   · token vencido (pedido más viejo que token_ttl_days) → NOT_FOUND;
--   · cancelar por el token libera la reserva.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/I01c_token_ajeno.sql
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

select pg_temp.como_bff();
set local role service_role;
do $$
declare a jsonb; b jsonb; v jsonb; t text; res0 int; res1 int;
begin
  a := public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('socio.a@qa.test'), 'transfer', null, gen_random_uuid(), '10.0.0.1');
  b := public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null, pg_temp.comprador('socio.b@qa.test'), 'transfer', null, gen_random_uuid(), '10.0.0.2');

  foreach t in array array[repeat('0', 64), upper(a->>'access_token'), left(a->>'access_token', 63), '', 'x',
                           (select guest_token_hash from public.orders where id = (a->>'order_id')::uuid)] loop
    begin
      perform public.guest_order_view(t);
      raise exception 'FALLO: guest_order_view abrió algo con %', t;
    exception when others then
      if sqlerrm <> 'NOT_FOUND' then raise; end if;
    end;
  end loop;
  raise notice 'OK: token inventado, en mayúsculas, recortado, vacío o el propio hash → NOT_FOUND';

  v := public.guest_order_view(a->>'access_token');
  if v->'order'->>'id' <> a->>'order_id' then raise exception 'FALLO: el token de A abre otra orden'; end if;
  begin
    perform public.guest_order_submit_receipt(a->>'access_token', (b->>'order_id') || '/comprobante.png');
    raise exception 'FALLO: con el token de A se subió comprobante a la carpeta de B';
  exception when others then
    if sqlerrm <> 'INVALID_RECEIPT_PATH' then raise; end if;
  end;
  if (select status from public.orders where id = (b->>'order_id')::uuid) <> 'pending_payment' then
    raise exception 'FALLO: B cambió de estado';
  end if;
  raise notice 'OK: con el token de A no se toca el pedido de B';

  -- Cancelar por el token libera la reserva (y solo la suya).
  select reserved into res0 from public.products where id = '00000000-0000-4000-d000-00000000f101';
  perform public.guest_order_cancel(a->>'access_token', 'ya no lo necesito');
  select reserved into res1 from public.products where id = '00000000-0000-4000-d000-00000000f101';
  if (select status from public.orders where id = (a->>'order_id')::uuid) <> 'cancelled' or res1 <> res0 - 1
     or (select status from public.orders where id = (b->>'order_id')::uuid) <> 'pending_payment' then
    raise exception 'FALLO: cancelar por token (reserva % → %)', res0, res1;
  end if;
  begin
    perform public.guest_order_cancel(a->>'access_token', null);
    raise exception 'FALLO: canceló dos veces';
  exception when others then
    if sqlerrm <> 'INVALID_STATE' then raise; end if;
  end;
  raise notice 'OK: cancelar por el token libera SU reserva; no se cancela dos veces';

  -- Vencido: el pedido es más viejo que la vida del enlace.
  update public.orders set created_at = now() - interval '181 days' where id = (b->>'order_id')::uuid;
  begin
    perform public.guest_order_view(b->>'access_token');
    raise exception 'FALLO: el enlace vencido sigue abriendo';
  exception when others then
    if sqlerrm <> 'NOT_FOUND' then raise; end if;
  end;
  raise notice 'OK: enlace vencido (token_ttl_days) → NOT_FOUND';
end $$;
reset role;

rollback;
