-- B01c (tienda · código de retiro regenerable) — solo pedidos de retiro pagados
-- y sin entregar: entregado, sin pagar y con envío → no.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/B01c_codigo_retiro_entregado.sql
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
-- La tienda entrega con el código original.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.order_transition(current_setting('qa.o1')::uuid, 'preparing', null, null, null);
select public.order_transition(current_setting('qa.o1')::uuid, 'ready_for_pickup', null, null, null);
select public.order_transition(current_setting('qa.o1')::uuid, 'delivered', null,
                               jsonb_build_object('pickup_code', current_setting('qa.code0')), null);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  begin
    perform public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid, null);
    raise exception 'FALLO: regeneró el código de un pedido entregado';
  exception when others then
    if sqlerrm <> 'INVALID_STATE' then raise; end if;
    raise notice 'OK: pedido entregado → INVALID_STATE';
  end;

  -- Sin pagar (efectivo al retirar, pending_payment): fuera de esta versión.
  r := public.create_cart_order(jsonb_build_array(jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000001','quantity',1)),
                                'pickup', null, null, null, 'cash_pickup', null, null, gen_random_uuid());
  begin
    perform public.regenerate_my_pickup_code((r->>'order_id')::uuid, null);
    raise exception 'FALLO: regeneró el código de un pedido sin pagar';
  exception when others then
    if sqlerrm <> 'INVALID_STATE' then raise; end if;
    raise notice 'OK: pedido sin pagar → INVALID_STATE';
  end;

  -- Envío a domicilio: no tiene código de retiro.
  r := public.create_cart_order(jsonb_build_array(jsonb_build_object('variant_id','00000000-0000-4000-e000-000000000001','quantity',1)),
                                'shipping', null, '{"departamento":"Antioquia","ciudad":"Medellín","direccion":"Cra 1 # 2-3"}'::jsonb,
                                null, 'transfer', null, null, gen_random_uuid());
  begin
    perform public.regenerate_my_pickup_code((r->>'order_id')::uuid, null);
    raise exception 'FALLO: regeneró código en un pedido con envío';
  exception when others then
    if sqlerrm <> 'NOT_A_PICKUP_ORDER' then raise; end if;
    raise notice 'OK: pedido con envío → NOT_A_PICKUP_ORDER';
  end;
end $$;

reset role;
do $$ begin
  if exists (select 1 from public.order_status_history h join public.orders o on o.id = h.order_id
              where o.user_id = current_setting('qa.u_padre')::uuid and h.note like 'Código de retiro regenerado%'
                and h.created_at >= now()) then
    raise exception 'FALLO: un intento rechazado dejó auditoría';
  end if;
  raise notice 'OK: los rechazos no escriben historial';
end $$;

rollback;
