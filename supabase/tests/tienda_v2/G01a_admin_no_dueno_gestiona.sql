-- G01a (tienda escolar, lado escuela) — un school_admin que NO es dueño
-- administra la tienda de su escuela: la encuentra por school_id, lee sus
-- ajustes y cambia los cobros. El coach y el padre no.
-- (Bug N0: el frontend buscaba el perfil por user_id y lo mandaba a /vendor/onboarding.)
-- Correr:  npm run qa:sql -- supabase/tests/tienda_v2/G01a_admin_no_dueno_gestiona.sql
begin;

select set_config('qa.school_a', (select school_id::text from qa_twin.actores where alias = 'owner.a'), true);
select set_config('qa.vp_a',     (select vendor_profile_id::text from qa_twin.actores where alias = 'owner.a'), true);
update public.platform_config set value = '{"enabled": true}'::jsonb where key = 'store_enabled';
update public.school_settings
   set payment_accounts = '[{"id":"g-nequi","type":"nequi","label":"Nequi del club","value":"3001112233","active":true}]'::jsonb
 where school_id = current_setting('qa.school_a')::uuid;

-- Como GYM RM antes de activar: perfil escolar 'pending' (la RLS de
-- vendor_profiles solo deja verlo a su dueño).
update public.vendor_profiles set verification_status = 'pending' where id = current_setting('qa.vp_a')::uuid;

-- ── admin.a (school_admin, no dueño) ─────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = 'admin.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb; v_id uuid; n int;
begin
  if (select user_id from public.vendor_profiles where id = current_setting('qa.vp_a')::uuid) = auth.uid() then
    raise exception 'FALLO: el fixture no sirve, admin.a es dueño del perfil';
  end if;
  -- La tienda se encuentra POR ESCUELA (lo que ahora hace useSchoolStore).
  if not public.can_manage_store(current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: can_manage_store=false para el school_admin';
  end if;
  raise notice 'OK: el school_admin encuentra la tienda por school_id y can_manage_store=true';

  -- La lectura que usa el frontend (useSchoolStore), con el perfil 'pending' (como GYM RM).
  if exists (select 1 from public.vendor_profiles where id = current_setting('qa.vp_a')::uuid) then
    raise exception 'FALLO: el fixture no sirve: la RLS ya deja ver el perfil pending al admin';
  end if;
  r := public.my_school_store(current_setting('qa.school_a')::uuid);
  if r->>'id' <> current_setting('qa.vp_a') or r->>'vendor_type' <> 'school' then
    raise exception 'FALLO: my_school_store para el admin: %', r;
  end if;
  raise notice 'OK: my_school_store resuelve la tienda por escuela para el admin no dueño';

  -- enable_school_store desde el admin: idempotente, devuelve la MISMA tienda (no abre otra).
  v_id := public.enable_school_store(current_setting('qa.school_a')::uuid);
  if v_id <> current_setting('qa.vp_a')::uuid then raise exception 'FALLO: enable devolvió otra tienda %', v_id; end if;
  raise notice 'OK: el admin activa (idempotente) la tienda de la escuela, sin perfil propio';

  r := public.store_admin_settings(current_setting('qa.vp_a')::uuid, null);
  if r->'store'->>'id' <> current_setting('qa.vp_a') or jsonb_array_length(r->'accounts') <> 1
     or r->'accounts'->0->>'value_masked' <> '•••• 2233' or r->'accounts'->0 ? 'value' then
    raise exception 'FALLO: store_admin_settings: %', r;
  end if;
  raise notice 'OK: store_admin_settings devuelve la tienda y las llaves ENMASCARADAS (sin número completo)';

  r := public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
         '{"accept_transfer":true,"accept_cash_pickup":false,"allow_shipping":true,"transfer_account_ids":["g-nequi"]}'::jsonb, null);
  if not (r->>'accept_transfer')::boolean or (r->>'accept_cash_pickup')::boolean
     or not (r->>'allow_shipping')::boolean or r->'transfer_account_ids' <> '["g-nequi"]'::jsonb
     or r->>'updated_by' <> auth.uid()::text then
    raise exception 'FALLO: set_store_payment_settings como admin: %', r;
  end if;
  raise notice 'OK: el admin no dueño guarda los cobros (queda como updated_by)';

  begin
    perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid,
              '{"accept_transfer":false,"accept_cash_pickup":false,"accept_wompi":false,"accept_mercadopago":false}'::jsonb, null);
    raise exception 'FALLO: dejó la tienda sin ningún medio de pago';
  exception when others then
    if sqlerrm not like 'NO_PAYMENT_METHODS%' then raise; end if;
    raise notice 'OK: sin ningún medio → NO_PAYMENT_METHODS';
  end;

  -- Escritura directa: sigue cerrada (solo por RPC).
  begin
    update public.store_payment_settings set accept_wompi = true where vendor_profile_id = current_setting('qa.vp_a')::uuid;
    raise exception 'FALLO: UPDATE directo permitido';
  exception when insufficient_privilege then raise notice 'OK: UPDATE directo → 42501';
  end;
end $$;
reset role;

-- ── coach.a y padre.a: no administran ────────────────────────────────────────
do $$
declare a text;
begin
  foreach a in array array['coach.a', 'padre.a'] loop
    perform set_config('request.jwt.claims', json_build_object('sub', (select user_id from qa_twin.actores where alias = a), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    if public.my_school_store(current_setting('qa.school_a')::uuid) is not null then
      raise exception 'FALLO: my_school_store responde a %', a;
    end if;
    begin
      perform public.store_admin_settings(current_setting('qa.vp_a')::uuid, null);
      raise exception 'FALLO: % lee los ajustes de la tienda', a;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.set_store_payment_settings(current_setting('qa.vp_a')::uuid, '{"accept_cash_pickup":true}'::jsonb, null);
      raise exception 'FALLO: % cambia los cobros', a;
    exception when insufficient_privilege then null;
    end;
    execute 'reset role';
    raise notice 'OK: % → NOT_OWNER en ajustes y cobros', a;
  end loop;
end $$;

-- anon sin EXECUTE en la lectura de ajustes.
set local role anon;
do $$ begin
  begin
    perform public.store_admin_settings('00000000-0000-4000-c000-0000000000a1'::uuid, null);
    raise exception 'FALLO: anon ejecuta store_admin_settings';
  exception when insufficient_privilege then raise notice 'OK: anon sin EXECUTE en store_admin_settings';
  end;
end $$;
reset role;
rollback;
