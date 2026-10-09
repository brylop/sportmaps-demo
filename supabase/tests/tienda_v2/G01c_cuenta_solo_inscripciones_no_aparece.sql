-- G01c — una llave marcada «Solo para inscripciones» (only_for) NO aparece en
-- la tienda: ni al comprador, ni como elegible en Ajustes. Tampoco el «Link de
-- pago (Wompi)» ni las apagadas. Una llave con only_for ['articulos'] sí.
-- La escuela elige cuáles mostrar (transfer_account_ids).
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/G01c_cuenta_solo_inscripciones_no_aparece.sql
begin;

select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.vp_a',     (select vendor_profile_id::text from qa_twin.actores where alias = 'owner.a'), true);
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
update public.school_settings
   set payment_accounts = '[
         {"id":"gen","type":"nequi","label":"Nequi del club","value":"3001112233","active":true},
         {"id":"insc","type":"nequi","label":"Nequi personal de la dueña","value":"3009998877","active":true,"only_for":["inscripcion"]},
         {"id":"art","type":"daviplata","label":"Daviplata uniformes","value":"3104445566","active":true,"only_for":["articulos"]},
         {"id":"link","type":"payment_link","label":"Wompi","value":"https://checkout.wompi.co/l/QA","active":true},
         {"id":"off","type":"breb","label":"Bre-B vieja","value":"@vieja","active":false}
       ]'::jsonb,
       bank_account_number = '3009998877', bank_name = 'Nequi'   -- legacy con el MISMO número restringido
 where school_id = current_setting('qa.school_a')::uuid;
insert into public.store_payment_settings (vendor_profile_id, accept_transfer, accept_cash_pickup, transfer_account_ids)
values (current_setting('qa.vp_a')::uuid, true, true, null)
on conflict (vendor_profile_id) do update set accept_transfer = true, transfer_account_ids = null;

do $$
declare v jsonb; ids text[];
begin
  v := public._store_transfer_accounts(current_setting('qa.vp_a')::uuid);
  select array_agg(x->>'id' order by x->>'id') into ids from jsonb_array_elements(v) x;
  if ids is distinct from array['art','gen'] then
    raise exception 'FALLO: cuentas en la tienda = % (esperado art, gen)', v;
  end if;
  if v::text like '%3009998877%' then
    raise exception 'FALLO: el número «solo inscripciones» se coló (también por la cuenta legacy)';
  end if;
  raise notice 'OK: la tienda muestra solo las aptas (general + «artículos»); no la de inscripciones, ni link, ni apagada, ni la legacy duplicada';
end $$;

-- Ajustes (admin no dueño): la restringida sale NO elegible con su motivo.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; a jsonb;
begin
  r := public.store_admin_settings(current_setting('qa.vp_a')::uuid, null);
  select x into a from jsonb_array_elements(r->'accounts') x where x->>'id' = 'insc';
  if (a->>'eligible')::boolean or a->>'reason' <> 'restricted' or (a->>'selected')::boolean then
    raise exception 'FALLO: la de inscripciones en Ajustes: %', a;
  end if;
  select x into a from jsonb_array_elements(r->'accounts') x where x->>'id' = 'link';
  if (a->>'eligible')::boolean or a->>'reason' <> 'payment_link' then raise exception 'FALLO: link: %', a; end if;
  raise notice 'OK: Ajustes muestra la de inscripciones como no elegible (restricted)';

  begin
    perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid, '{"transfer_account_ids":["insc"]}'::jsonb, null);
    raise exception 'FALLO: dejó elegir la llave de inscripciones para la tienda';
  exception when others then
    if sqlerrm not like 'INVALID_TRANSFER_ACCOUNT%' then raise; end if;
    raise notice 'OK: elegir la de inscripciones → INVALID_TRANSFER_ACCOUNT';
  end;

  perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid, '{"transfer_account_ids":["gen"]}'::jsonb, null);
end $$;
reset role;

do $$
declare v jsonb;
begin
  v := public._store_transfer_accounts(current_setting('qa.vp_a')::uuid);
  if jsonb_array_length(v) <> 1 or v->0->>'id' <> 'gen' then
    raise exception 'FALLO: con selección [gen] la tienda muestra %', v;
  end if;
  raise notice 'OK: la escuela elige qué llaves se muestran ([gen] → solo esa)';
end $$;

-- Transferencia encendida sin ninguna llave visible → NO_TRANSFER_ACCOUNTS.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
              '{"accept_transfer":true,"transfer_account_ids":[]}'::jsonb, null);
    raise exception 'FALLO: transferencia sin llaves visibles';
  exception when others then
    if sqlerrm not like 'NO_TRANSFER_ACCOUNTS%' then raise; end if;
    raise notice 'OK: transferencia con selección vacía → NO_TRANSFER_ACCOUNTS';
  end;
end $$;
reset role;
rollback;
