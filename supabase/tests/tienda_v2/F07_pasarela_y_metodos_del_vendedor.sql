-- M-F0-7 (tienda v2 F0) — pasarela y medios de pago del vendedor (D-5 = A).
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/F07_pasarela_y_metodos_del_vendedor.sql
--
-- Casos (plan M-F0-7): anon/authenticated no leen access_token/webhook_secret/
-- integrity_secret (escuela ni vendedor) ni la tabla de secretos cifrados;
-- set_store_payment_settings: coach → NOT_OWNER, Wompi sin pasarela →
-- GATEWAY_NOT_CONFIGURED, transferencia sin cuentas → NO_TRANSFER_ACCOUNTS;
-- escuela sin pasarela propia solo ofrece transferencia/efectivo aunque haya
-- fila de pasarela SIN secretos; store_payment_methods solo expone public_key;
-- la tabla store_payment_settings no se escribe directo.

begin;

update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.u_admin',  (select user_id::text from qa_twin.actores where alias = 'admin.a'), true);
select set_config('qa.u_coach',  (select user_id::text from qa_twin.actores where alias = 'coach.a'), true);
select set_config('qa.u_vend',   (select user_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_ok',    (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);

select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select set_config('qa.vp_a', public.enable_school_store(current_setting('qa.school_a')::uuid)::text, true);
reset role;

-- Escuela A: fila Wompi "conectada" pero SIN secretos cifrados (como Monster´s sin
-- configurar) y con secretos legacy en claro en la tabla.
insert into public.school_payment_providers (id, school_id, provider, public_key, access_token, integrity_secret, sandbox, enabled, connect_status)
values ('00000000-0000-4000-9000-0000000000b1', current_setting('qa.school_a')::uuid, 'wompi', 'pub_test_QA_ESCUELA',
        'prv_test_EN_CLARO', 'int_EN_CLARO', true, true, 'connected');
-- Vendedor externo: pasarela con secretos cifrados.
insert into public.vendor_payment_providers (id, vendor_id, provider, public_key, sandbox, is_default, enabled)
values ('00000000-0000-4000-9000-0000000000b2', current_setting('qa.u_vend')::uuid, 'wompi', 'pub_test_QA_VEND_F07', true, true, true);
insert into public.vendor_payment_provider_secrets (provider_id, private_key_enc, integrity_secret_enc)
values ('00000000-0000-4000-9000-0000000000b2', 'gcm:qa:priv', 'gcm:qa:int');

-- ── anon ─────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$
begin
  begin perform access_token from public.vendor_payment_providers; raise exception 'FALLO: anon vendor_payment_providers';
  exception when insufficient_privilege then null; end;
  begin perform public_key from public.school_payment_providers; raise exception 'FALLO: anon school_payment_providers';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.vendor_payment_provider_secrets; raise exception 'FALLO: anon secretos';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.store_payment_settings; raise exception 'FALLO: anon settings';
  exception when insufficient_privilege then null; end;
  raise notice 'OK: anon → 42501 en pasarelas, secretos y medios';
end $$;

-- ── Vendedor externo dueño ───────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_vend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; m jsonb;
begin
  begin perform access_token from public.vendor_payment_providers; raise exception 'FALLO: el dueño lee access_token';
  exception when insufficient_privilege then null; end;
  begin perform integrity_secret from public.vendor_payment_providers; raise exception 'FALLO: integrity_secret';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.vendor_payment_provider_secrets; raise exception 'FALLO: tabla de secretos';
  exception when insufficient_privilege then null; end;
  if (select public_key from public.vendor_payment_providers where id = '00000000-0000-4000-9000-0000000000b2') <> 'pub_test_QA_VEND_F07' then
    raise exception 'FALLO: el dueño no ve su llave pública';
  end if;
  raise notice 'OK: el dueño ve public_key pero no access_token/integrity_secret ni secretos cifrados';

  begin
    perform public.set_store_payment_settings(current_setting('qa.vp_ok')::uuid, '{"accept_transfer":true}'::jsonb, null);
    raise exception 'FALLO: transferencia sin cuentas';
  exception when others then
    if sqlerrm <> 'NO_TRANSFER_ACCOUNTS' then raise; end if;
  end;
  begin
    perform public.set_store_payment_settings(current_setting('qa.vp_ok')::uuid, '{"accept_mercadopago":true}'::jsonb, null);
    raise exception 'FALLO: MP sin pasarela';
  exception when others then
    if sqlerrm <> 'GATEWAY_NOT_CONFIGURED' then raise; end if;
  end;
  r := public.set_store_payment_settings(current_setting('qa.vp_ok')::uuid, '{"accept_wompi":true,"accept_cash_pickup":true,"cash_hold_hours":24}'::jsonb, null);
  if not (r->>'accept_wompi')::boolean or (r->>'cash_hold_hours')::int <> 24 then raise exception 'FALLO: settings %', r; end if;
  begin
    update public.store_payment_settings set accept_transfer = true;
    raise exception 'FALLO: UPDATE directo de settings';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: NO_TRANSFER_ACCOUNTS / GATEWAY_NOT_CONFIGURED; Wompi propio + efectivo aceptados; sin UPDATE directo';

  m := public.store_payment_methods(current_setting('qa.vp_ok')::uuid);
  if jsonb_array_length(m->'methods') <> 2
     or (select x->>'public_key' from jsonb_array_elements(m->'methods') x where x->>'method' = 'wompi') <> 'pub_test_QA_VEND_F07'
     or m::text ~* '(gcm:|prv_|int_)' then
    raise exception 'FALLO: store_payment_methods %', m;
  end if;
  raise notice 'OK: store_payment_methods = wompi (llave pública del vendedor) + efectivo, sin secretos';
end $$;

-- ── Escuela: coach no configura; admin no puede prender Wompi sin secretos ──
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_coach'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid, '{"accept_cash_pickup":true}'::jsonb, null);
  raise exception 'FALLO: el coach configuró medios de pago';
exception when insufficient_privilege then raise notice 'OK: coach → NOT_OWNER';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin perform access_token from public.school_payment_providers; raise exception 'FALLO: admin lee access_token en claro';
  exception when insufficient_privilege then null; end;
  if (select public_key from public.school_payment_providers where id = '00000000-0000-4000-9000-0000000000b1') <> 'pub_test_QA_ESCUELA' then
    raise exception 'FALLO: admin no ve la llave pública';
  end if;
  begin
    perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid, '{"accept_wompi":true}'::jsonb, null);
    raise exception 'FALLO: Wompi con solo secretos en claro';
  exception when others then
    if sqlerrm <> 'GATEWAY_NOT_CONFIGURED' then raise; end if;
  end;
  -- Todos los medios explícitos: la preparación del E2E deja la transferencia
  -- prendida en esta tienda y set_store_payment_settings solo cambia lo que recibe.
  perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
    '{"accept_cash_pickup":true,"accept_transfer":false,"accept_wompi":false,"accept_mercadopago":false}'::jsonb, null);
  if (select count(*) from jsonb_array_elements(public.store_payment_methods(current_setting('qa.vp_a')::uuid)->'methods')) <> 1 then
    raise exception 'FALLO: medios de la escuela';
  end if;
  raise notice 'OK: admin no lee secretos en claro; Wompi sin secretos cifrados → GATEWAY_NOT_CONFIGURED; queda solo efectivo';
end $$;

-- ── upsert_vendor_provider (BFF, service role): secretos cifrados, nada en claro ─
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare v_id uuid; v_id2 uuid; r record;
begin
  v_id := public.upsert_vendor_provider(current_setting('qa.u_vend')::uuid, 'mercadopago', 'TEST-pub-QA',
            '{"access_token_enc":"gcm:tok","events_secret_enc":"gcm:evt"}'::jsonb, true, true, false);
  v_id2 := public.upsert_vendor_provider(current_setting('qa.u_vend')::uuid, 'mercadopago', 'TEST-pub-QA-2',
            '{"access_token_enc":"gcm:tok2"}'::jsonb, true, true, false);
  select p.access_token, p.webhook_secret, p.public_key, s.access_token_enc, s.events_secret_enc into r
    from public.vendor_payment_providers p join public.vendor_payment_provider_secrets s on s.provider_id = p.id
   where p.id = v_id;
  if v_id <> v_id2 or r.access_token is not null or r.webhook_secret is not null or r.public_key <> 'TEST-pub-QA-2'
     or r.access_token_enc <> 'gcm:tok2' or r.events_secret_enc <> 'gcm:evt' then
    raise exception 'FALLO: upsert_vendor_provider %', row_to_json(r);
  end if;
  raise notice 'OK: upsert_vendor_provider guarda cifrado, deja las columnas en claro en NULL y no borra un secreto ausente';
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('qa.u_vend'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  perform public.upsert_vendor_provider(auth.uid(), 'wompi', 'pub', '{}'::jsonb, true, true, false);
  raise exception 'FALLO: authenticated ejecuta upsert_vendor_provider';
exception when insufficient_privilege then raise notice 'OK: upsert_vendor_provider solo service_role';
end $$;

rollback;
