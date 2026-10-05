-- C01 · R1 (spec §8.2) — cada rol llama finance_income_summary / _lines de la
-- escuela A. owner / school_admin / accountant / super_admin ✅;
-- coach / staff / reporter / parent / athlete / owner de OTRA escuela / anon → 42501.
-- Además: school_payment_kpis con el mismo gate (coach no ve ingresos).
--
-- Actores (seed qa_twin_seed.sql, UUID fijos):
--   owner.a …a…01 · admin.a (school_admin) …a…02 · coach.a …a…03 · padre.a …a…04
--   atleta.a …a…06 · owner.b …a…07 · superadmin …a…10 · escuela A …b…01
-- Se crean en la transacción: contador …c1, staff …c2, reporter …c3 (miembros de A).

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
select v.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v.email, 'x', now(),
       jsonb_build_object('full_name', v.email), '{}'::jsonb, now(), now()
  from (values ('00000000-0000-4000-a000-0000000000c1'::uuid, 'contador.a@qa.sportmaps.test'),
               ('00000000-0000-4000-a000-0000000000c2'::uuid, 'staff.a@qa.sportmaps.test'),
               ('00000000-0000-4000-a000-0000000000c3'::uuid, 'reporter.a@qa.sportmaps.test')) v(id, email);
insert into public.school_members (school_id, profile_id, role, status) values
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-0000000000c1', 'accountant', 'active'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-0000000000c2', 'staff',      'active'),
  ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-0000000000c3', 'reporter',   'active');

-- Función de prueba (temporal, se va con el rollback): llama las RPC como el
-- usuario `p_uid` y devuelve 'ok:<total>' o 'denied'.
create function pg_temp.ingresos_como(p_uid uuid) returns text language plpgsql as $f$
declare v numeric;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    select coalesce(sum(income_amount), 0) into v
      from public.finance_income_summary('school', '00000000-0000-4000-b000-000000000001',
                                         '2026-01-01', '2026-12-31', null, 'month');
    execute 'reset role';
    return 'ok:' || v;
  exception when insufficient_privilege then
    execute 'reset role';
    return 'denied';
  end;
end $f$;

do $$
declare
  r record;
  v text;
begin
  for r in select * from (values
      ('owner.a',    '00000000-0000-4000-a000-000000000001'::uuid, true),
      ('admin.a',    '00000000-0000-4000-a000-000000000002'::uuid, true),
      ('contador',   '00000000-0000-4000-a000-0000000000c1'::uuid, true),
      ('superadmin', '00000000-0000-4000-a000-000000000010'::uuid, true),
      ('coach.a',    '00000000-0000-4000-a000-000000000003'::uuid, false),
      ('staff',      '00000000-0000-4000-a000-0000000000c2'::uuid, false),
      ('reporter',   '00000000-0000-4000-a000-0000000000c3'::uuid, false),
      ('padre.a',    '00000000-0000-4000-a000-000000000004'::uuid, false),
      ('atleta.a',   '00000000-0000-4000-a000-000000000006'::uuid, false),
      ('owner.b',    '00000000-0000-4000-a000-000000000007'::uuid, false)) t(alias, uid, puede)
  loop
    v := pg_temp.ingresos_como(r.uid);
    if r.puede and v <> 'ok:200000' then
      raise exception 'FALLO: % debía leer los ingresos de A (200000) y obtuvo %', r.alias, v;
    elsif not r.puede and v <> 'denied' then
      raise exception 'FALLO: % debía recibir 42501 y obtuvo % (nunca ceros)', r.alias, v;
    end if;
    raise notice 'OK: % → %', r.alias, v;
  end loop;
end $$;

-- anon: sin EXECUTE (42501 de privilegio, no del gate).
set local role anon;
do $$ begin
  begin
    perform * from public.finance_income_summary('school', '00000000-0000-4000-b000-000000000001',
                                                 '2026-01-01', '2026-12-31', null, 'month');
    raise exception 'FALLO: anon ejecuta finance_income_summary';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501';
  end;
end $$;
reset role;

-- school_payment_kpis: mismo gate. Coach → 42501; contador ✅.
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000003','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.school_payment_kpis('00000000-0000-4000-b000-000000000001', null);
    raise exception 'FALLO: el coach lee school_payment_kpis';
  exception when insufficient_privilege then raise notice 'OK: coach → 42501 en school_payment_kpis';
  end;
  begin
    perform * from public.finance_income_lines('school', '00000000-0000-4000-b000-000000000001',
                                               '2026-01-01', '2026-12-31');
    raise exception 'FALLO: el coach lee finance_income_lines';
  exception when insufficient_privilege then raise notice 'OK: coach → 42501 en finance_income_lines';
  end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-0000000000c1','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v jsonb;
begin
  v := public.school_payment_kpis('00000000-0000-4000-b000-000000000001', null);
  if (v->>'revenue_total')::numeric <> 200000 then
    raise exception 'FALLO: contador ve revenue_total % (esperado 200000)', v->>'revenue_total';
  end if;
  raise notice 'OK: contador lee KPIs (revenue_total 200000)';
end $$;
reset role;

-- R8 (parte de F0): escuela SIN addon accounting → la lectura de ingresos sigue.
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000007','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v numeric;
begin
  select coalesce(sum(income_amount), 0) into v
    from public.finance_income_summary('school', '00000000-0000-4000-b000-000000000002', '2026-01-01', '2026-12-31');
  if v <> 120000 then raise exception 'FALLO: owner B sin addon lee % de su escuela (esperado 120000)', v; end if;
  raise notice 'OK: owner B (sin addon accounting) lee sus ingresos: %', v;
end $$;
reset role;

rollback;
