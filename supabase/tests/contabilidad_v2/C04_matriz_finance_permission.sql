-- C04 · Matriz §3.8 de finance_permission + envoltorio can_manage_finances
-- (M1; R5, R7, R8 en lo que aplica a F0; N4; U7; U10).
--   · owner A (con addon accounting): todo ✅.
--   · owner B (SIN addon): read ✅, write/pay ❌ (U10) pero can_manage_finances ✅
--     (N4: la facturación electrónica no se rompe por no tener el addon).
--   · coach / padre: todo ❌.  · super admin: todo ✅ en cualquier escuela (U7).
--   · vendedor dueño ✅ sobre su perfil; vendedor ajeno ❌ (R7).
--   · organizer ✅ sobre sí mismo, ❌ sobre otro.
--   · sin JWT (service_role / cron): finance_permission = false y
--     can_manage_finances = false, NUNCA NULL (las RPC hacen `IF NOT …`).
--   · acción inválida → 22023.

begin;

-- ids de vendedor del seed (no son fijos): leerlos ANTES de bajar de rol
select set_config('qa.vp_ok',   (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.ok'), true);
select set_config('qa.vp_pend', (select vendor_profile_id::text from qa_twin.actores where alias = 'vendedor.pend'), true);

-- sin JWT
do $$ begin
  if public.can_manage_finances('school', '00000000-0000-4000-b000-000000000001') is distinct from false then
    raise exception 'FALLO: can_manage_finances sin JWT no es false (es %)',
      public.can_manage_finances('school', '00000000-0000-4000-b000-000000000001');
  end if;
  if public.finance_permission('school', '00000000-0000-4000-b000-000000000001', 'read') is distinct from false then
    raise exception 'FALLO: finance_permission sin JWT no es false';
  end if;
  begin
    perform public.finance_permission('school', '00000000-0000-4000-b000-000000000001', 'borrar');
    raise exception 'FALLO: acción inválida aceptada';
  exception when invalid_parameter_value then raise notice 'OK: acción inválida → 22023';
  end;
  raise notice 'OK: sin JWT → false (no NULL)';
end $$;

create function pg_temp.perm(p_uid uuid, p_type text, p_owner uuid) returns text language plpgsql as $f$
declare r text := ''; acc text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  foreach acc in array array['read','write','pay','void','close','reopen','configure','export'] loop
    r := r || case when public.finance_permission(p_type, p_owner, acc) then '1' else '0' end;
  end loop;
  r := r || '|' || case when public.can_manage_finances(p_type, p_owner) then '1' else '0' end;
  execute 'reset role';
  return r;
end $f$;

do $$
declare
  a  constant uuid := '00000000-0000-4000-b000-000000000001';
  b  constant uuid := '00000000-0000-4000-b000-000000000002';
  vp_ok   uuid := current_setting('qa.vp_ok')::uuid;
  vp_pend uuid := current_setting('qa.vp_pend')::uuid;
  r record;
  v text;
begin
  --                        read write pay void close reopen configure export | can_manage
  for r in select * from (values
      ('owner.a sobre A',       '00000000-0000-4000-a000-000000000001'::uuid, 'school', a, '11111111|1'),
      ('admin.a sobre A',       '00000000-0000-4000-a000-000000000002'::uuid, 'school', a, '11111111|1'),
      ('owner.b sobre B s/addon','00000000-0000-4000-a000-000000000007'::uuid, 'school', b, '10000001|1'),
      ('owner.b sobre A',       '00000000-0000-4000-a000-000000000007'::uuid, 'school', a, '00000000|0'),
      ('owner.a sobre B',       '00000000-0000-4000-a000-000000000001'::uuid, 'school', b, '00000000|0'),
      ('coach.a sobre A',       '00000000-0000-4000-a000-000000000003'::uuid, 'school', a, '00000000|0'),
      ('padre.a sobre A',       '00000000-0000-4000-a000-000000000004'::uuid, 'school', a, '00000000|0'),
      ('atleta.a sobre A',      '00000000-0000-4000-a000-000000000006'::uuid, 'school', a, '00000000|0'),
      ('superadmin sobre B',    '00000000-0000-4000-a000-000000000010'::uuid, 'school', b, '11111111|1'),
      ('vendedor.ok propio',    '00000000-0000-4000-a000-000000000008'::uuid, 'vendor', vp_ok,   '11111111|1'),
      ('vendedor.pend ajeno',   '00000000-0000-4000-a000-000000000009'::uuid, 'vendor', vp_ok,   '00000000|0'),
      ('vendedor.ok ajeno',     '00000000-0000-4000-a000-000000000008'::uuid, 'vendor', vp_pend, '00000000|0'),
      ('organizer propio',      '00000000-0000-4000-a000-000000000009'::uuid, 'organizer', '00000000-0000-4000-a000-000000000009'::uuid, '11111111|1'),
      ('organizer ajeno',       '00000000-0000-4000-a000-000000000009'::uuid, 'organizer', '00000000-0000-4000-a000-000000000008'::uuid, '00000000|0'),
      ('owner.a tipo inválido', '00000000-0000-4000-a000-000000000001'::uuid, 'banco', a, '00000000|0')
    ) t(caso, uid, tipo, dueno, esperado)
  loop
    v := pg_temp.perm(r.uid, r.tipo, r.dueno);
    if v <> r.esperado then
      raise exception 'FALLO: % → % (esperado %)', r.caso, v, r.esperado;
    end if;
    raise notice 'OK: % → %', r.caso, v;
  end loop;
end $$;

-- N4: owner B (sin addon accounting) sigue leyendo sus facturas electrónicas.
insert into public.electronic_invoices (owner_type, owner_id, provider, payment_id, document_type, reference_code, status)
values ('school', '00000000-0000-4000-b000-000000000002', 'factus', '00000000-0000-4000-f000-000000000004',
        'invoice', 'QA-N4-1', 'accepted');
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000007','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v int;
begin
  select count(*) into v from public.electronic_invoices where owner_id = '00000000-0000-4000-b000-000000000002';
  if v <> 1 then raise exception 'FALLO: owner B (sin addon) ve % facturas propias (N4: esperado 1)', v; end if;
  raise notice 'OK: N4 — owner B sin addon accounting sigue viendo su factura electrónica';
end $$;
reset role;

rollback;
