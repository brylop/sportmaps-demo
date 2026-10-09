-- B01d (tienda · código de retiro regenerable) — tope de 3 regeneraciones por
-- pedido: la cuarta → PICKUP_CODE_LIMIT y el último código sigue valiendo.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/B01d_codigo_retiro_limite.sql
begin;
-- ── Fixture (postgres): tienda de A con transferencia (y envío, para el caso con
--    domicilio; allow_shipping se ignora si la base no tiene la mig. 20261008163336);
--    padre.a compra 1 camiseta S
--    con retiro en sede y la escuela aprueba el comprobante → orden `paid`.
--    Todo dentro del ROLLBACK; ids generados por la RPC (sin llaves fijas).
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.u_padre',  (select user_id::text from qa_twin.actores where alias = 'padre.a'), true);
select set_config('qa.u_padreb', (select user_id::text from qa_twin.actores where alias = 'padre.b'), true);
select set_config('qa.u_admin',  (select user_id::text from qa_twin.actores where alias = 'admin.a'), true);
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);

select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.vp_a', public.enable_school_store(current_setting('qa.school_a')::uuid)::text, true);
reset role;
update public.products set vendor_profile_id = current_setting('qa.vp_a')::uuid
 where id = '00000000-0000-4000-d000-000000000001';
insert into public.school_settings (school_id, payment_accounts)
values (current_setting('qa.school_a')::uuid,
        '[{"id":"qa1","type":"nequi","label":"Nequi","value":"3000000000","active":true}]'::jsonb)
on conflict (school_id) do update set payment_accounts = excluded.payment_accounts;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
         '{"accept_transfer":true,"accept_cash_pickup":true,"accept_wompi":false,"accept_mercadopago":false,"allow_shipping":true}'::jsonb, null);
reset role;

-- Compra con retiro (padre.a) → comprobante → aprobación (admin.a).
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.created', public.create_cart_order(
         jsonb_build_array(jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000001','quantity',1)),
         'pickup', null, null, null, 'transfer', null, null, gen_random_uuid())::text, true);
select set_config('qa.o1', current_setting('qa.created')::jsonb ->> 'order_id', true);
select set_config('qa.code0', current_setting('qa.created')::jsonb ->> 'pickup_code', true);
select public.submit_order_receipt(current_setting('qa.o1')::uuid, current_setting('qa.o1') || '/comprobante.jpg', null);
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.approve_order_receipt(current_setting('qa.o1')::uuid, null);
reset role;
do $$ begin
  if (select status from public.orders where id = current_setting('qa.o1')::uuid) <> 'paid' then
    raise exception 'FALLO (fixture): la orden no quedó pagada';
  end if;
  if current_setting('qa.code0') !~ '^[0-9]{6}$' then raise exception 'FALLO (fixture): sin código de retiro inicial'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; i int; v_last text;
begin
  for i in 1..3 loop
    r := public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid, null);
    if (r->>'regenerations_used')::int <> i or (r->>'regenerations_left')::int <> 3 - i then
      raise exception 'FALLO: conteo en la vuelta % → %', i, r;
    end if;
    v_last := r->>'pickup_code';
  end loop;
  perform set_config('qa.last', v_last, true);
  raise notice 'OK: tres regeneraciones (quedan 0)';
  begin
    perform public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid, null);
    raise exception 'FALLO: cuarta regeneración aceptada';
  exception when others then
    if sqlerrm <> 'PICKUP_CODE_LIMIT' then raise; end if;
    raise notice 'OK: la cuarta → PICKUP_CODE_LIMIT';
  end;
end $$;

reset role;
do $$
declare n int;
begin
  select count(*) into n from public.order_status_history
   where order_id = current_setting('qa.o1')::uuid and note like 'Código de retiro regenerado%';
  if n <> 3 then raise exception 'FALLO: % filas de auditoría (esperado 3)', n; end if;
  if (select pickup_code_hash from public.orders where id = current_setting('qa.o1')::uuid)
     <> encode(sha256(convert_to(current_setting('qa.last') || ':' || current_setting('qa.o1'), 'UTF8')), 'hex') then
    raise exception 'FALLO: el rechazo por tope cambió el código vigente';
  end if;
  raise notice 'OK: 3 filas de auditoría; el último código sigue vigente';
end $$;

-- Service role (BFF) con p_actor = comprador: mismo tope (no hay atajo por el BFF).
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ begin
  begin
    perform public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid, current_setting('qa.u_padre')::uuid);
    raise exception 'FALLO: el BFF se salta el tope';
  exception when others then
    if sqlerrm <> 'PICKUP_CODE_LIMIT' then raise; end if;
    raise notice 'OK: por el BFF (service role + p_actor) también PICKUP_CODE_LIMIT';
  end;
end $$;

rollback;
