-- B01a (tienda · código de retiro regenerable, mig. 20261008163338) — el COMPRADOR
-- genera un código nuevo desde cualquier dispositivo: el anterior deja de servir,
-- el nuevo entrega el pedido, queda rastro en order_status_history.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/B01a_codigo_retiro_comprador.sql
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
-- ── El comprador regenera (pedido pagado, sin entregar) ──────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  -- p_actor ajeno se ignora con JWT: el actor es auth.uid().
  r := public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid, current_setting('qa.u_padreb')::uuid);
  if r->>'pickup_code' !~ '^[0-9]{6}$' or (r->>'regenerations_used')::int <> 1 or (r->>'regenerations_left')::int <> 2
     or r->>'status' <> 'paid' then
    raise exception 'FALLO: respuesta %', r;
  end if;
  perform set_config('qa.code1', r->>'pickup_code', true);
  raise notice 'OK: el comprador genera un código nuevo (1 de 3) con el pedido pagado';
end $$;
reset role;
do $$
declare h record; v_hash text;
begin
  select pickup_code_hash into v_hash from public.orders where id = current_setting('qa.o1')::uuid;
  if v_hash <> encode(sha256(convert_to(current_setting('qa.code1') || ':' || current_setting('qa.o1'), 'UTF8')), 'hex') then
    raise exception 'FALLO: el hash guardado no es el del código nuevo';
  end if;
  if current_setting('qa.code1') <> current_setting('qa.code0')
     and v_hash = encode(sha256(convert_to(current_setting('qa.code0') || ':' || current_setting('qa.o1'), 'UTF8')), 'hex') then
    raise exception 'FALLO: el código anterior sigue valiendo';
  end if;
  select * into h from public.order_status_history
   where order_id = current_setting('qa.o1')::uuid and note like 'Código de retiro regenerado%';
  if h.id is null or h.actor_role <> 'buyer' or h.actor_id <> current_setting('qa.u_padre')::uuid
     or h.from_status <> 'paid' or h.to_status <> 'paid' or position(current_setting('qa.code1') in h.note) > 0 then
    raise exception 'FALLO: auditoría %', row_to_json(h);
  end if;
  raise notice 'OK: solo el hash del código nuevo; historial con actor comprador, sin el código en claro';
end $$;

-- El comprador ve la fila de auditoría en su línea de tiempo y no puede escribirla.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.order_status_history where order_id = current_setting('qa.o1')::uuid and note like 'Código de retiro regenerado%') then
    raise exception 'FALLO: el comprador no ve la regeneración en su historial';
  end if;
  begin
    insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
    values (current_setting('qa.o1')::uuid, 'paid', 'paid', auth.uid(), 'buyer', 'Código de retiro regenerado por el comprador (falso)');
    raise exception 'FALLO: el comprador escribe el historial directo (falsearía el tope)';
  exception when insufficient_privilege then raise notice 'OK: historial de solo lectura para el comprador (42501)';
  end;
end $$;

-- ── La tienda prepara y deja listo; el comprador regenera otra vez en ready_for_pickup ──
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.order_transition(current_setting('qa.o1')::uuid, 'preparing', null, null, null);
select public.order_transition(current_setting('qa.o1')::uuid, 'ready_for_pickup', null, null, null);
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padre'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.code2', public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid) ->> 'pickup_code', true);

-- ── Entrega: el código viejo ya no sirve, el nuevo sí ────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  if current_setting('qa.code1') <> current_setting('qa.code2') then
    begin
      perform public.order_transition(current_setting('qa.o1')::uuid, 'delivered', null,
                                      jsonb_build_object('pickup_code', current_setting('qa.code1')), null);
      raise exception 'FALLO: la tienda entregó con el código anterior';
    exception when insufficient_privilege then
      if sqlerrm <> 'INVALID_PICKUP_CODE' then raise; end if;
      raise notice 'OK: con el código anterior → INVALID_PICKUP_CODE';
    end;
  end if;
  r := public.order_transition(current_setting('qa.o1')::uuid, 'delivered', null,
                               jsonb_build_object('pickup_code', current_setting('qa.code2')), null);
  if (select status from public.orders where id = current_setting('qa.o1')::uuid) <> 'delivered' then
    raise exception 'FALLO: no entregó con el código nuevo %', r;
  end if;
  raise notice 'OK: con el código nuevo la tienda entrega (delivered)';
end $$;

rollback;
