-- G01e — modalidad de entrega de la tienda: «solo retiro en sede» bloquea una
-- orden con envío (SHIPPING_NOT_OFFERED) y las sedes de retiro se respetan.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/G01e_entrega_solo_retiro_y_sedes.sql
begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.vp_a',     (select vendor_profile_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.main',     (select id::text from public.school_branches where school_id = current_setting('qa.school_a')::uuid order by is_main desc nulls last, created_at limit 1), true);
insert into public.school_branches (id, school_id, name, address, is_main, status)
values ('00000000-0000-4000-f000-0000000000e1', current_setting('qa.school_a')::uuid, 'QA Sede Norte', 'Calle 170 # 1-1', false, 'active');
update public.school_settings
   set payment_accounts = '[{"id":"gen","type":"nequi","label":"Nequi","value":"3001112233","active":true}]'::jsonb
 where school_id = current_setting('qa.school_a')::uuid;
-- Balón público sin variantes, a la tienda de A, con stock de sobra.
update public.products set vendor_profile_id = current_setting('qa.vp_a')::uuid, stock = greatest(stock, reserved + 5)
 where id = '00000000-0000-4000-d000-000000000002';
insert into public.store_payment_settings (vendor_profile_id, accept_transfer, accept_cash_pickup, allow_shipping)
values (current_setting('qa.vp_a')::uuid, true, true, true)
on conflict (vendor_profile_id) do update set accept_transfer = true, accept_cash_pickup = true;

-- La escuela (admin no dueño) elige: solo retiro, en la Sede Norte.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
            '{"allow_shipping":false,"pickup_branch_ids":["00000000-0000-4000-f000-0000000000e1"]}'::jsonb, null);
  begin
    perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid, '{"pickup_branch_ids":[]}'::jsonb, null);
    raise exception 'FALLO: aceptó cero sedes de retiro';
  exception when others then
    if sqlerrm not like 'PICKUP_BRANCH_REQUIRED%' then raise; end if;
  end;
  begin
    perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
              '{"pickup_branch_ids":["00000000-0000-4000-f000-00000000dead"]}'::jsonb, null);
    raise exception 'FALLO: aceptó una sede ajena';
  exception when others then
    if sqlerrm not like 'INVALID_PICKUP_BRANCH%' then raise; end if;
  end;
  raise notice 'OK: la escuela guarda solo retiro + Sede Norte; rechaza 0 sedes y sedes ajenas';
end $$;
reset role;

-- Comprador miembro.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'padre.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; items jsonb := '[{"product_id":"00000000-0000-4000-d000-000000000002","quantity":1}]';
begin
  if not public.store_seller_allowed(current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: la tienda A no vende en el gemelo (store_seller_allowed=false)';
  end if;
  begin
    perform public.create_cart_order(items, 'shipping', null, '{"departamento":"Antioquia","direccion":"Cra 1 # 2-3"}'::jsonb,
                                     null, 'transfer', null, null, gen_random_uuid());
    raise exception 'FALLO: orden con envío en una tienda de solo retiro';
  exception when others then
    if sqlerrm not like 'SHIPPING_NOT_OFFERED%' then raise; end if;
    raise notice 'OK: envío en tienda de solo retiro → SHIPPING_NOT_OFFERED';
  end;

  r := public.create_cart_order(items, 'pickup', null, null, null, 'cash_pickup', null, null, gen_random_uuid());
  if (select pickup_branch_id from public.orders where id = (r->>'order_id')::uuid) <> '00000000-0000-4000-f000-0000000000e1' then
    raise exception 'FALLO: sin sede elegida no quedó en la Sede Norte: %', r;
  end if;
  raise notice 'OK: sin sede elegida, la orden queda en la única sede de retiro permitida';

  r := public.store_payment_methods(current_setting('qa.vp_a')::uuid);
  if (r->'fulfillment'->>'shipping')::boolean
     or jsonb_array_length(r->'fulfillment'->'pickup_branches') <> 1
     or r->'fulfillment'->'pickup_branches'->0->>'name' <> 'QA Sede Norte' then
    raise exception 'FALLO: la vitrina no publica la entrega: %', r->'fulfillment';
  end if;
  raise notice 'OK: store_payment_methods publica «solo retiro» y la Sede Norte';
end $$;
reset role;
rollback;
