-- I01f (compra sin cuenta, mig. 20261013170553) — vinculación a la cuenta:
--   · el socio se registra con el MISMO correo: mientras no confirme, sus
--     pedidos siguen sin cuenta; al confirmar (email_confirmed_at NULL → fecha)
--     pasan a su cuenta y queda rastro en el historial;
--   · un pedido con OTRO correo no se vincula;
--   · el token del enlace sigue abriendo el pedido ya vinculado;
--   · link_my_guest_orders(): quien ya tenía cuenta (correo confirmado) los
--     trae al abrir "Mis compras"; con correo SIN confirmar → 0.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/I01f_vinculacion_al_registrarse.sql
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
select set_config('qa.o1', (public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null,
         pg_temp.comprador('Nuevo.Socio@qa.test'), 'transfer', null, gen_random_uuid(), null) ->> 'order_id'), true);
select set_config('qa.o2', (public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null,
         pg_temp.comprador('otro.correo@qa.test'), 'transfer', null, gen_random_uuid(), null) ->> 'order_id'), true);
reset role;
select set_config('request.jwt.claims', null, true);

-- Registro con el mismo correo, sin confirmar (como lo deja el signup de Supabase).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        email_change_token_current, phone_change, phone_change_token, reauthentication_token,
                        is_sso_user, is_anonymous)
values ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-00000000f1f1', 'authenticated', 'authenticated',
        'nuevo.socio@qa.test', extensions.crypt('QaGemelo2026!', extensions.gen_salt('bf')), null,
        '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nuevo Socio","role":"athlete"}'::jsonb,
        now(), now(), '', '', '', '', '', '', '', '', false, false);

do $$
begin
  if (select user_id from public.orders where id = current_setting('qa.o1')::uuid) is not null then
    raise exception 'FALLO: se vinculó antes de confirmar el correo';
  end if;
  raise notice 'OK: registrado sin confirmar → el pedido sigue sin cuenta';
end $$;

-- Sin confirmar, link_my_guest_orders no trae nada.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-a000-00000000f1f1', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.link_my_guest_orders();
  if (r->>'linked')::int <> 0 or r->>'reason' <> 'EMAIL_NOT_CONFIRMED' then raise exception 'FALLO: sin confirmar %', r; end if;
  raise notice 'OK: link_my_guest_orders con correo sin confirmar → 0 (EMAIL_NOT_CONFIRMED)';
end $$;
reset role;
select set_config('request.jwt.claims', null, true);

-- Confirma el correo.
update auth.users set email_confirmed_at = now() where id = '00000000-0000-4000-a000-00000000f1f1';

do $$
begin
  if (select user_id from public.orders where id = current_setting('qa.o1')::uuid) is distinct from '00000000-0000-4000-a000-00000000f1f1'::uuid then
    raise exception 'FALLO: al confirmar el correo el pedido no pasó a la cuenta';
  end if;
  if (select user_id from public.orders where id = current_setting('qa.o2')::uuid) is not null then
    raise exception 'FALLO: se vinculó un pedido de OTRO correo';
  end if;
  if not exists (select 1 from public.order_status_history
                  where order_id = current_setting('qa.o1')::uuid and note like 'Pedido vinculado a la cuenta%') then
    raise exception 'FALLO: sin rastro de la vinculación';
  end if;
  raise notice 'OK: al confirmar el correo, el pedido de ese correo pasa a la cuenta (con rastro); el de otro correo no';
end $$;

-- Ya es suyo: lo ve con su JWT y opera como cualquier comprador.
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-a000-00000000f1f1', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  if not exists (select 1 from public.orders where id = current_setting('qa.o1')::uuid) then
    raise exception 'FALLO: el dueño no ve su pedido vinculado';
  end if;
  if exists (select 1 from public.orders where id = current_setting('qa.o2')::uuid) then
    raise exception 'FALLO: ve el pedido de otro correo';
  end if;
  r := public.submit_order_receipt(current_setting('qa.o1')::uuid, current_setting('qa.o1') || '/comprobante.png', null);
  if r->>'status' <> 'awaiting_approval' then raise exception 'FALLO: comprador vinculado no sube comprobante: %', r; end if;
  raise notice 'OK: el pedido vinculado se ve y se opera desde la cuenta';
end $$;
reset role;

-- Quien ya tenía cuenta (padre.a, correo confirmado) y compró como invitado con ese correo.
select pg_temp.como_bff();
set local role service_role;
select set_config('qa.o3', (public.create_guest_cart_order(pg_temp.carrito(), 'pickup', null, null,
         pg_temp.comprador('PADRE.A@qa.sportmaps.test'), 'transfer', null, gen_random_uuid(), null) ->> 'order_id'), true);
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  if exists (select 1 from public.orders where id = current_setting('qa.o3')::uuid) then
    raise exception 'FALLO: lo ve antes de vincular';
  end if;
  r := public.link_my_guest_orders();
  if (r->>'linked')::int <> 1 then raise exception 'FALLO: link_my_guest_orders %', r; end if;
  if not exists (select 1 from public.orders where id = current_setting('qa.o3')::uuid and user_id = auth.uid()) then
    raise exception 'FALLO: no quedó vinculado';
  end if;
  r := public.link_my_guest_orders();
  if (r->>'linked')::int <> 0 then raise exception 'FALLO: segunda llamada vinculó de nuevo %', r; end if;
  raise notice 'OK: link_my_guest_orders trae el pedido de invitado de su correo confirmado (idempotente)';
end $$;
reset role;

rollback;
