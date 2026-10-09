-- B01b (tienda · código de retiro regenerable) — nadie más que el comprador:
-- otro usuario (padre.b), la propia tienda (admin.a) y anon no regeneran.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/B01b_codigo_retiro_ajeno.sql
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
select set_config('qa.hash0', (select pickup_code_hash from public.orders where id = current_setting('qa.o1')::uuid), true);

-- ── Otro comprador ───────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_padreb'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    -- Aunque mande p_actor = el dueño: con JWT manda auth.uid().
    perform public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid, current_setting('qa.u_padre')::uuid);
    raise exception 'FALLO: un usuario ajeno regeneró el código';
  exception when others then
    if sqlerrm <> 'NOT_FOUND' then raise; end if;
    raise notice 'OK: usuario ajeno → NOT_FOUND (no revela la orden)';
  end;
end $$;

-- ── La tienda (admin de la escuela) tampoco: el código es del comprador ──────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid, null);
    raise exception 'FALLO: la tienda regeneró el código del comprador';
  exception when others then
    if sqlerrm <> 'NOT_FOUND' then raise; end if;
    raise notice 'OK: quien administra la tienda → NOT_FOUND';
  end;
end $$;

-- ── anon: sin EXECUTE ────────────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  begin
    perform public.regenerate_my_pickup_code(current_setting('qa.o1')::uuid, current_setting('qa.u_padre')::uuid);
    raise exception 'FALLO: anon ejecuta regenerate_my_pickup_code';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 (sin EXECUTE)';
  end;
end $$;

-- ── Nada cambió; grants y search_path ────────────────────────────────────────
reset role;
do $$ begin
  if (select pickup_code_hash from public.orders where id = current_setting('qa.o1')::uuid) <> current_setting('qa.hash0')
     or exists (select 1 from public.order_status_history where order_id = current_setting('qa.o1')::uuid and note like 'Código de retiro regenerado%') then
    raise exception 'FALLO: un intento rechazado cambió el código o dejó auditoría';
  end if;
  if not has_function_privilege('authenticated', 'public.regenerate_my_pickup_code(uuid, uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.regenerate_my_pickup_code(uuid, uuid)', 'EXECUTE') then
    raise exception 'FALLO: grants (authenticated sí / anon no)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'regenerate_my_pickup_code' and prosecdef
                   and 'search_path=pg_catalog, public, pg_temp' = any(proconfig)) then
    raise exception 'FALLO: SECURITY DEFINER sin search_path fijo';
  end if;
  raise notice 'OK: el código y el historial quedan intactos; grants y search_path correctos';
end $$;

rollback;
