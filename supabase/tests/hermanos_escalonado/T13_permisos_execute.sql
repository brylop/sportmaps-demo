-- F2 hermanos · T13: anon y authenticated NO tienen EXECUTE en los helpers
-- (solo service_role); las RPC de la app sí para authenticated y no para
-- anon; las 5 reemplazadas conservan sus ACL vivas.
begin;
do $$
declare
  f text; bad text := '';
begin
  foreach f in array array[
    'public._sibling_family(uuid,uuid[])',
    'public._sibling_rank(uuid,uuid,timestamptz)',
    'public._sibling_tier_pct(uuid,integer)',
    'public.sibling_discount_quote(uuid,uuid,uuid,uuid)',
    'public._sibling_link_core(uuid,uuid[],text,uuid)',
    'public._descuentos_automaticos_calc(public.payments)',
    'public._plan_charge_operation(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb)',
    'public.create_enrollment_with_payments(uuid,jsonb,jsonb)'] loop
    if has_function_privilege('anon', f, 'EXECUTE') then bad := bad || ' anon:' || f; end if;
    if has_function_privilege('authenticated', f, 'EXECUTE') then bad := bad || ' authenticated:' || f; end if;
    if not has_function_privilege('service_role', f, 'EXECUTE') then bad := bad || ' sin-service_role:' || f; end if;
  end loop;
  foreach f in array array[
    'public.link_siblings(uuid,uuid[])', 'public.unlink_sibling(uuid,uuid)',
    'public.get_sibling_family(uuid,uuid)',
    'public.open_month(uuid,integer,integer,uuid)', 'public.preview_open_month(uuid,integer,integer,uuid)'] loop
    if has_function_privilege('anon', f, 'EXECUTE') then bad := bad || ' anon:' || f; end if;
    if not has_function_privilege('authenticated', f, 'EXECUTE') then bad := bad || ' sin-authenticated:' || f; end if;
  end loop;
  if has_table_privilege('anon', 'public.school_sibling_links', 'SELECT')
     or has_table_privilege('authenticated', 'public.school_sibling_links', 'INSERT')
     or has_table_privilege('authenticated', 'public.school_sibling_links', 'UPDATE')
     or has_table_privilege('authenticated', 'public.school_sibling_links', 'DELETE') then
    bad := bad || ' tabla school_sibling_links';
  end if;
  if bad <> '' then raise exception 'FALLO: permisos:%', bad; end if;
  raise notice 'OK: helpers solo service_role; RPC de app sin anon; tabla solo SELECT para authenticated';
end $$;

-- Prueba viva: authenticated no puede llamar el helper.
select set_config('request.jwt.claims',
  json_build_object('sub', '6c0b38bb-5c7c-45f0-99e4-cb543b60ea21', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public._sibling_rank('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', '8dd99bb9-3786-4800-9c04-c541ca83486d');
    raise exception 'FALLO: authenticated ejecutó _sibling_rank';
  exception when insufficient_privilege then raise notice 'OK: authenticated → _sibling_rank 42501';
  end;
end $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.link_siblings('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', array[gen_random_uuid(), gen_random_uuid()]);
    raise exception 'FALLO: anon ejecutó link_siblings';
  exception when insufficient_privilege then raise notice 'OK: anon → link_siblings 42501';
  end;
end $$;
rollback;
