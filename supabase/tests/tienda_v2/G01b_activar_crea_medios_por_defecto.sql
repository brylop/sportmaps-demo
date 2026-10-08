-- G01b — enable_school_store deja la tienda lista para cobrar: crea la fila de
-- medios por defecto (transferencia con las llaves aptas + efectivo al
-- retirar + solo retiro en sede) y no pisa una configuración existente.
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/G01b_activar_crea_medios_por_defecto.sql
begin;

select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.vp_a',     (select vendor_profile_id::text from qa_twin.actores where alias = 'owner.a'), true);
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
delete from public.store_payment_settings where vendor_profile_id = current_setting('qa.vp_a')::uuid;
update public.school_settings
   set payment_accounts = '[{"id":"g-breb","type":"breb","label":"Bre-B","value":"@gymqa","active":true}]'::jsonb,
       bank_account_number = null
 where school_id = current_setting('qa.school_a')::uuid;

select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.enable_school_store(current_setting('qa.school_a')::uuid);
reset role;

do $$
declare s public.store_payment_settings%rowtype; m jsonb;
begin
  select * into s from public.store_payment_settings where vendor_profile_id = current_setting('qa.vp_a')::uuid;
  if s.vendor_profile_id is null then raise exception 'FALLO: activar no creó store_payment_settings'; end if;
  if not s.accept_transfer or not s.accept_cash_pickup or s.accept_wompi or s.accept_mercadopago
     or s.allow_shipping or s.transfer_account_ids is not null or s.pickup_branch_ids is not null
     or s.transfer_hold_hours <> 48 or s.transfer_instructions is null then
    raise exception 'FALLO: medios por defecto equivocados: %', to_jsonb(s);
  end if;
  raise notice 'OK: transferencia (todas las llaves aptas) + efectivo + solo retiro, 48 h';

  m := public.store_payment_methods(current_setting('qa.vp_a')::uuid);
  if (m->>'allowed')::boolean then
    if not (m->'methods' @> '[{"method":"transfer"}]' and m->'methods' @> '[{"method":"cash_pickup"}]') then
      raise exception 'FALLO: la vitrina no ve los medios por defecto: %', m;
    end if;
    if (m->'fulfillment'->>'shipping')::boolean or jsonb_array_length(m->'fulfillment'->'pickup_branches') < 1 then
      raise exception 'FALLO: entrega publicada mal: %', m->'fulfillment';
    end if;
    raise notice 'OK: store_payment_methods publica transferencia + efectivo y «solo retiro» con su sede';
  else
    raise exception 'FALLO: la tienda A no vende en el gemelo (store_seller_allowed=false)';
  end if;
end $$;

-- Una configuración que la escuela ya tocó NO se pisa al volver a activar.
update public.store_payment_settings set accept_cash_pickup = false, allow_shipping = true
 where vendor_profile_id = current_setting('qa.vp_a')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'owner.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.enable_school_store(current_setting('qa.school_a')::uuid);
reset role;
do $$ begin
  if (select accept_cash_pickup or not allow_shipping from public.store_payment_settings
       where vendor_profile_id = current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: reactivar pisó la configuración de la escuela';
  end if;
  raise notice 'OK: reactivar no pisa la configuración existente';
end $$;

-- Escuela SIN llaves aptas (solo una restringida a inscripciones): nace sin
-- transferencia (no ofrece un medio que no puede cumplir) pero con efectivo.
delete from public.store_payment_settings where vendor_profile_id = current_setting('qa.vp_a')::uuid;
update public.school_settings
   set payment_accounts = '[{"id":"g-insc","type":"nequi","label":"Nequi dueña","value":"3009998877","active":true,"only_for":["inscripcion"]}]'::jsonb
 where school_id = current_setting('qa.school_a')::uuid;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.enable_school_store(current_setting('qa.school_a')::uuid);
reset role;
do $$ begin
  if (select accept_transfer or not accept_cash_pickup from public.store_payment_settings
       where vendor_profile_id = current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: sin llaves aptas igual prendió transferencia (o apagó efectivo)';
  end if;
  raise notice 'OK: sin llaves aptas → solo efectivo al retirar';
end $$;
rollback;
