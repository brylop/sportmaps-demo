-- I01b (compra sin cuenta, mig. 20261013170553) — el BFF (service role) crea
-- el pedido de un socio SIN cuenta y todo el ciclo funciona por el token:
--   · orden con user_id NULL, guest_email en minúsculas, token de 64 hex que
--     se devuelve UNA vez (la base guarda solo el sha256), rastro en el log;
--   · reintento con la misma idempotency key → misma orden, sin token nuevo;
--   · guest_order_view: estado, ítems, cuentas REALES para transferir, sede;
--   · comprobante por el token → awaiting_approval; la escuela aprueba (JWT
--     de admin.a, como la UI) → paid; el enlace lo ve pagado;
--   · código de retiro: se regenera por el token (pagado), el hash cambia y
--     queda el mismo rastro que el del comprador con cuenta (1 de 3);
--   · teléfono opcional; el monto lo pone la base.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/I01b_invitado_por_bff.sql
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
declare
  k uuid := gen_random_uuid();
  r jsonb; r2 jsonb; v jsonb; o public.orders%rowtype; n int;
begin
  r := public.create_guest_cart_order(pg_temp.carrito(2), 'pickup', null, null,
         jsonb_build_object('email', '  Socio.SinCuenta@QA.test ', 'name', 'Socio   Sin Cuenta', 'phone', '300 123 4567',
                            'unit_price', 1, 'total', 1),
         'transfer', null, k, '181.63.24.103');
  perform set_config('qa.order', r->>'order_id', true);
  perform set_config('qa.token', r->>'access_token', true);
  if r->>'access_token' !~ '^[0-9a-f]{64}$' then raise exception 'FALLO: token %', r->>'access_token'; end if;
  if (r->>'total')::numeric <> 80000 then raise exception 'FALLO: el total lo debe poner la base (80000): %', r->>'total'; end if;
  select * into o from public.orders where id = (r->>'order_id')::uuid;
  if o.user_id is not null then raise exception 'FALLO: la orden de invitado tiene user_id'; end if;
  if o.guest_email <> 'socio.sincuenta@qa.test' then raise exception 'FALLO: guest_email %', o.guest_email; end if;
  if o.guest_token_hash <> encode(sha256(convert_to(r->>'access_token', 'UTF8')), 'hex') then
    raise exception 'FALLO: guest_token_hash no es el sha256 del token';
  end if;
  if o.customer_name <> 'Socio Sin Cuenta' or o.contact_phone <> '3001234567' or o.status <> 'pending_payment' then
    raise exception 'FALLO: snapshot del comprador % / % / %', o.customer_name, o.contact_phone, o.status;
  end if;
  if position(r->>'access_token' in coalesce(o.buyer_snapshot::text, '') || coalesce(o.notes, '')) > 0 then
    raise exception 'FALLO: el token quedó en claro en la orden';
  end if;
  select count(*) into n from public.store_guest_checkout_log where order_id = o.id and ip_hash is not null and email_hash ~ '^[0-9a-f]{64}$';
  if n <> 1 then raise exception 'FALLO: rastro del log (%)', n; end if;
  if exists (select 1 from public.store_guest_checkout_log where email_hash like '%socio%' or ip_hash like '%181.63%') then
    raise exception 'FALLO: el log guarda correo o IP en claro';
  end if;
  raise notice 'OK: orden sin cuenta (user_id NULL), correo normalizado, token 64 hex solo como sha256, total de la base, log con hashes';

  r2 := public.create_guest_cart_order(pg_temp.carrito(2), 'pickup', null, null,
          pg_temp.comprador('socio.sincuenta@qa.test'), 'transfer', null, k, '181.63.24.103');
  if r2->>'order_id' <> r->>'order_id' or not (r2->>'idempotent')::boolean or r2->>'access_token' is not null then
    raise exception 'FALLO: reintento idempotente %', r2;
  end if;
  select count(*) into n from public.orders where guest_email = 'socio.sincuenta@qa.test';
  if n <> 1 then raise exception 'FALLO: el reintento creó otra orden (%)', n; end if;
  raise notice 'OK: mismo clic reintentado → misma orden, sin token nuevo';

  v := public.guest_order_view(r->>'access_token');
  if v->'order'->>'id' <> r->>'order_id' or v->'order'->>'status' <> 'pending_payment'
     or jsonb_array_length(v->'items') <> 1 or (v->'items'->0->>'quantity')::int <> 2
     or v->'order'->>'email_masked' not like 'so•••@qa.test'
     or (v->'order'->>'linked_to_account')::boolean then
    raise exception 'FALLO: guest_order_view %', v;
  end if;
  if not exists (select 1 from jsonb_array_elements(v->'transfer'->'accounts') a where a->>'value' = '000-QA-INVITADO') then
    raise exception 'FALLO: el enlace no muestra las cuentas reales de la tienda: %', v->'transfer';
  end if;
  if v->'pickup_branch' is null and exists (select 1 from public.school_branches where school_id = current_setting('qa.school_a')::uuid and coalesce(status,'active') = 'active') then
    raise exception 'FALLO: sin sede de retiro en la vista';
  end if;
  if (v->'pickup'->>'can_regenerate')::boolean then raise exception 'FALLO: regenerar código sin pagar'; end if;
  raise notice 'OK: el enlace muestra estado, ítems, correo enmascarado y las cuentas REALES para transferir';

  -- Código de retiro antes de pagar: no.
  begin
    perform public.guest_order_regenerate_pickup_code(r->>'access_token');
    raise exception 'FALLO: regeneró el código de una orden sin pagar';
  exception when others then
    if sqlerrm <> 'INVALID_STATE' then raise; end if;
  end;

  -- Comprobante por el token.
  begin
    perform public.guest_order_submit_receipt(r->>'access_token', 'otra-orden/x.png');
    raise exception 'FALLO: ruta de comprobante fuera de la orden';
  exception when others then
    if sqlerrm <> 'INVALID_RECEIPT_PATH' then raise; end if;
  end;
  r2 := public.guest_order_submit_receipt(r->>'access_token', (r->>'order_id') || '/comprobante.png');
  if r2->>'status' <> 'awaiting_approval' then raise exception 'FALLO: comprobante %', r2; end if;
  if not exists (select 1 from public.order_status_history
                  where order_id = (r->>'order_id')::uuid and to_status = 'awaiting_approval' and actor_role = 'buyer') then
    raise exception 'FALLO: historial del comprobante';
  end if;
  raise notice 'OK: comprobante por el token → awaiting_approval (ruta fuera de la orden rechazada)';
end $$;
reset role;

-- La escuela aprueba con su JWT, como en la UI (StoreOrdersPage → BFF → approve_order_receipt).
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; n int;
begin
  -- La tienda VE el pedido de invitado (orders_select_vendor), aunque no tenga user_id.
  select count(*) into n from public.orders where id = current_setting('qa.order')::uuid and user_id is null;
  if n <> 1 then raise exception 'FALLO: la tienda no ve el pedido sin cuenta'; end if;
  r := public.approve_order_receipt(current_setting('qa.order')::uuid, null);
  if not coalesce((r->>'ok')::boolean, false) then raise exception 'FALLO: aprobar %', r; end if;
  raise notice 'OK: la escuela ve y aprueba el pedido sin cuenta';
end $$;
reset role;

select pg_temp.como_bff();
set local role service_role;
do $$
declare v jsonb; c jsonb; o public.orders%rowtype; old_hash text;
begin
  v := public.guest_order_view(current_setting('qa.token'));
  if v->'order'->>'status' <> 'paid' or v->'transfer' <> 'null'::jsonb then
    raise exception 'FALLO: el enlace no ve el pedido pagado (o sigue mostrando cuentas): %', v->'order'->>'status';
  end if;
  if not (v->'pickup'->>'can_regenerate')::boolean then raise exception 'FALLO: pagado y no deja generar código'; end if;
  raise notice 'OK: el socio ve "pagado" con el enlace';

  select pickup_code_hash into old_hash from public.orders where id = current_setting('qa.order')::uuid;
  c := public.guest_order_regenerate_pickup_code(current_setting('qa.token'));
  select * into o from public.orders where id = current_setting('qa.order')::uuid;
  if c->>'pickup_code' !~ '^\d{6}$' or (c->>'regenerations_left')::int <> 2
     or o.pickup_code_hash <> encode(sha256(convert_to((c->>'pickup_code') || ':' || o.id::text, 'UTF8')), 'hex')
     or o.pickup_code_hash = old_hash then
    raise exception 'FALLO: regenerar por token %', c;
  end if;
  if not exists (select 1 from public.order_status_history h
                  where h.order_id = o.id and h.actor_role = 'buyer' and h.from_status = h.to_status
                    and h.note like 'Código de retiro regenerado por el comprador (1 de 3)%'
                    and position(c->>'pickup_code' in h.note) = 0) then
    raise exception 'FALLO: rastro de la regeneración';
  end if;
  v := public.guest_order_view(current_setting('qa.token'));
  if (v->'pickup'->>'regenerations_used')::int <> 1 then raise exception 'FALLO: conteo en la vista'; end if;
  raise notice 'OK: código de retiro nuevo por el enlace (6 dígitos, solo hash, rastro 1 de 3 sin el código)';
end $$;
reset role;

-- Teléfono opcional.
select pg_temp.como_bff();
set local role service_role;
do $$
declare r jsonb;
begin
  r := public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null,
         jsonb_build_object('email', 'sin.telefono@qa.test', 'name', 'Sin Teléfono'), 'cash_pickup', null, gen_random_uuid(), null);
  if r->>'pickup_code' !~ '^\d{6}$' or r->>'access_token' is null then raise exception 'FALLO: sin teléfono / efectivo %', r; end if;
  raise notice 'OK: teléfono opcional; efectivo al retirar devuelve el código de retiro y el token';
end $$;
reset role;

rollback;
