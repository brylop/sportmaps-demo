-- C13a · Ventas de la tienda en los ingresos de la escuela (migración
-- 20261013170548): el owner/admin/superadmin de A ven la venta de su tienda;
-- coach / padre / atleta / owner de OTRA escuela → 42501 (nunca ceros) en las
-- cuatro RPC; anon sin EXECUTE. Solo cuentan las órdenes COBRADAS del vendor
-- ESCOLAR de A: ni las de un vendedor externo ni las pendientes de pago.
-- Correr:  npm run qa:sql -- supabase/tests/contabilidad_v2/C13a_tienda_ingresos_permiso.sql

begin;

-- ── Preparación (como postgres; todo se va con el rollback) ──────────────────
insert into public.vendor_profiles (id, user_id, vendor_type, school_id, display_name, slug,
                                    verification_status, is_active, capabilities)
values ('00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001', 'school',
        '00000000-0000-4000-b000-000000000001', 'Tienda QA Academia Andes', 'tienda-qa-andes',
        'verified', true, '{"can_sell_products": true, "can_sell_services": false}'::jsonb)
on conflict (id) do update
   set vendor_type = 'school', school_id = excluded.school_id, verification_status = 'verified', is_active = true;

insert into public.orders (id, user_id, total_amount, status, vendor_profile_id, vendor_id, school_id,
                           payment_method, provider_transaction_id, paid_at, reference)
values
  -- venta cobrada de la tienda de A (septiembre)
  ('00000000-0000-4000-c000-0000000013a1', '00000000-0000-4000-a000-000000000004', 80000, 'delivered',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-b000-000000000001', 'wompi', 'tx-c13a-1', '2026-09-20 10:00:00-05', 'C13A-1'),
  -- pendiente de pago: no es ingreso
  ('00000000-0000-4000-c000-0000000013a2', '00000000-0000-4000-a000-000000000004', 55000, 'pending_payment',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-b000-000000000001', 'transfer', null, null, 'C13A-2'),
  -- vendedor EXTERNO verificado: no es de la escuela
  ('00000000-0000-4000-c000-0000000013a3', '00000000-0000-4000-a000-000000000004', 999000, 'paid',
   (select vendor_profile_id from qa_twin.actores where alias = 'vendedor.ok'),
   '00000000-0000-4000-a000-000000000008', null, 'wompi', 'tx-c13a-3', '2026-09-21 10:00:00-05', 'C13A-3');

create function pg_temp.tienda_como(p_uid uuid) returns text language plpgsql as $f$
declare v numeric; h boolean; o numeric; n int := 0;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    select coalesce(sum(income_amount), 0) into v
      from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31', null, 'month');
  exception when insufficient_privilege then n := n + 1;
  end;
  begin
    h := public.store_income_has_store('00000000-0000-4000-b000-000000000001');
  exception when insufficient_privilege then n := n + 1;
  end;
  begin
    perform * from public.store_income_lines('00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31');
  exception when insufficient_privilege then n := n + 1;
  end;
  begin
    select coalesce(sum(income_amount), 0) into o
      from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001',
                                           '2026-01-01', '2026-12-31', null, 'month')
     where origin = 'tienda';
  exception when insufficient_privilege then n := n + 1;
  end;
  execute 'reset role';
  if n = 4 then return 'denied'; end if;
  if n > 0 then return 'mixto:' || n; end if;
  return 'ok:' || v || ':' || h || ':' || o;
end $f$;

do $$
declare r record; v text;
begin
  for r in select * from (values
      ('owner.a',    '00000000-0000-4000-a000-000000000001'::uuid, true),
      ('admin.a',    '00000000-0000-4000-a000-000000000002'::uuid, true),
      ('superadmin', '00000000-0000-4000-a000-000000000010'::uuid, true),
      ('coach.a',    '00000000-0000-4000-a000-000000000003'::uuid, false),
      ('padre.a',    '00000000-0000-4000-a000-000000000004'::uuid, false),
      ('atleta.a',   '00000000-0000-4000-a000-000000000006'::uuid, false),
      ('owner.b',    '00000000-0000-4000-a000-000000000007'::uuid, false)) t(alias, uid, puede)
  loop
    v := pg_temp.tienda_como(r.uid);
    if r.puede and v <> 'ok:80000:true:80000' then
      raise exception 'FALLO: % debía ver 80000 de tienda (solo la venta cobrada del vendor escolar) y obtuvo %', r.alias, v;
    elsif not r.puede and v <> 'denied' then
      raise exception 'FALLO: % debía recibir 42501 en las 4 RPC y obtuvo % (nunca ceros)', r.alias, v;
    end if;
    raise notice 'OK: % → %', r.alias, v;
  end loop;
end $$;

-- owner.b: su escuela (B) no tiene tienda → false, y su tienda suma 0 (lectura legítima).
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000007','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v numeric;
begin
  if public.store_income_has_store('00000000-0000-4000-b000-000000000002') then
    raise exception 'FALLO: B sin tienda aparece con tienda';
  end if;
  select coalesce(sum(income_amount), 0) into v
    from public.store_income_summary('00000000-0000-4000-b000-000000000002', '2026-01-01', '2026-12-31');
  if v <> 0 then raise exception 'FALLO: B ve % de tienda', v; end if;
  raise notice 'OK: owner.b → su escuela sin tienda (false, 0)';
end $$;
reset role;

-- anon: sin EXECUTE (privilegio, no el gate).
set local role anon;
do $$ begin
  begin
    perform * from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31');
    raise exception 'FALLO: anon ejecuta store_income_summary';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 store_income_summary';
  end;
  begin
    perform * from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001', '2026-01-01', '2026-12-31');
    raise exception 'FALLO: anon ejecuta finance_income_by_origin';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 finance_income_by_origin';
  end;
end $$;
reset role;

-- Higiene de la migración: search_path fijo y sin EXECUTE para anon/PUBLIC.
do $$
declare r record;
begin
  for r in select p.proname, p.proconfig, p.proacl::text acl from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('store_income_has_store','store_income_lines','store_income_summary','finance_income_by_origin')
  loop
    if r.proconfig is null or not ('search_path=pg_catalog, public, pg_temp' = any (r.proconfig)) then
      raise exception 'FALLO: % sin search_path fijo', r.proname;
    end if;
    if r.acl ~ '(^|[{,])anon=' or r.acl ~ '(^|[{,])=X' then
      raise exception 'FALLO: % con EXECUTE para anon/PUBLIC: %', r.proname, r.acl;
    end if;
  end loop;
  raise notice 'OK: search_path fijo y sin EXECUTE para anon/PUBLIC';
end $$;

rollback;
