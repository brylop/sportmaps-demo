-- C03 · Rol contador (M1, N1; R5 de F0) — lee todo lo contable, cierra, NO escribe:
--   finance_permission read/export/close = t; write/pay/void/reopen/configure = f.
--   No es staff (staff_school_ids / user_staff_school_ids no lo incluyen).
--   No puede insertar pagos (camino staff) ni marcar uno 'paid'.
--   No puede insertar en teams ni en tablas contables.

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values ('00000000-0000-4000-a000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'contador.a@qa.sportmaps.test', 'x', now(), '{"full_name":"Contador QA"}', '{}', now(), now());
update public.profiles set role = 'accountant' where id = '00000000-0000-4000-a000-0000000000c1';
insert into public.school_members (school_id, profile_id, role, status)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-0000000000c1', 'accountant', 'active');

select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-0000000000c1','role','authenticated')::text, true);
set local role authenticated;

do $$
declare
  a constant uuid := '00000000-0000-4000-b000-000000000001';
  acc text;
  v_n int;
  v_status text;
begin
  -- Matriz §3.8 para el contador
  foreach acc in array array['read','export','close'] loop
    if not public.finance_permission('school', a, acc) then
      raise exception 'FALLO: contador sin permiso %', acc;
    end if;
  end loop;
  foreach acc in array array['write','pay','void','reopen','configure'] loop
    if public.finance_permission('school', a, acc) then
      raise exception 'FALLO: contador CON permiso %', acc;
    end if;
  end loop;
  if public.can_manage_finances('school', a) then
    raise exception 'FALLO: can_manage_finances = true para el contador';
  end if;
  raise notice 'OK: contador read/export/close ✅ · write/pay/void/reopen/configure ❌ · can_manage_finances ❌';

  -- N1: no es staff
  if a = any (public.user_staff_school_ids()) or a = any (public.staff_school_ids()) then
    raise exception 'FALLO: el contador cuenta como staff (N1)';
  end if;
  raise notice 'OK: contador fuera de staff_school_ids() y user_staff_school_ids()';

  -- Lee lo contable
  select count(*) into v_n from public.expenses where owner_id = a;
  if v_n <> 2 then raise exception 'FALLO: contador ve % gastos (esperado 2)', v_n; end if;
  select count(*) into v_n from public.supplier_bills where owner_id = a;
  if v_n <> 1 then raise exception 'FALLO: contador ve % facturas de proveedor (esperado 1)', v_n; end if;
  select count(*) into v_n from public.payroll_employees where owner_id = a;
  if v_n <> 1 then raise exception 'FALLO: contador ve % empleados de nómina (U2: esperado 1)', v_n; end if;
  select count(*) into v_n from public.payments where school_id = a;
  if v_n <> 3 then raise exception 'FALLO: contador ve % cobros de A (esperado 3)', v_n; end if;
  select count(*) into v_n from public.cash_ledger where owner_id = a and direction = 'income';
  if v_n <> 2 then raise exception 'FALLO: contador ve % ingresos en el libro (esperado 2)', v_n; end if;
  raise notice 'OK: contador lee gastos, facturas, nómina, cobros y libro';

  -- No inserta pagos por el camino de staff
  begin
    insert into public.payments (school_id, amount, status, concept, payment_method)
    values (a, 1000, 'paid', 'intento contador', 'cash');
    raise exception 'FALLO: el contador insertó un cobro paid';
  exception when insufficient_privilege then
    raise notice 'OK: insert de cobro como staff → 42501';
  end;

  -- No marca 'paid' un cobro existente (no hay policy UPDATE para él: 0 filas)
  update public.payments set status = 'paid', amount_paid = amount
   where id = '00000000-0000-4000-f000-000000000003';
  get diagnostics v_n = row_count;
  if v_n <> 0 then raise exception 'FALLO: el contador marcó paid un cobro (% filas)', v_n; end if;
  raise notice 'OK: update a paid → 0 filas';

  -- Hueco A1 (cualquier autenticado inserta con parent_id = sí mismo): lo cierra
  -- el guard de la Fase 1 (20261002125957, trg_zz_guard_payments_client), que es
  -- PRERREQUISITO de F0. Si el gemelo no lo tiene, se informa sin fallar.
  if exists (select 1 from pg_trigger where tgname = 'trg_zz_guard_payments_client') then
    begin
      insert into public.payments (school_id, parent_id, amount, status, concept, payment_method)
      values (a, auth.uid(), 1000, 'paid', 'intento contador', 'cash');
      raise exception 'FALLO: el contador insertó un cobro paid como pagador';
    exception when insufficient_privilege then
      raise notice 'OK: insert paid como pagador → 42501 (guard Fase 1)';
    end;
  else
    raise notice 'PENDIENTE: guard de Fase 1 (20261002125957) no aplicado en el gemelo; el camino parent_id=uid() se prueba al aplicarlo';
  end if;

  -- No escribe en equipos (era una de las 36 policies de staff)
  begin
    insert into public.teams (school_id, name) values (a, 'Equipo del contador');
    raise exception 'FALLO: el contador creó un equipo';
  exception when insufficient_privilege then
    raise notice 'OK: insert en teams → 42501';
  end;

  -- No registra gastos ni facturas
  begin
    insert into public.expenses (owner_type, owner_id, school_id, category_id, kind, status, concept, amount,
                                 expense_date, paid_date, created_by)
    values ('school', a, a, 'ca62fccf-00a1-42a5-b7b3-225f5381892f', 'manual', 'paid', 'gasto contador', 1000,
            current_date, current_date, auth.uid());
    raise exception 'FALLO: el contador registró un gasto';
  exception when insufficient_privilege then
    raise notice 'OK: insert de gasto → 42501';
  end;

  -- Ni paga facturas ni liquida nómina por RPC
  if (public.pay_supplier_bill('00000000-0000-4000-9000-000000000011', 1000, current_date, 'transfer', null)->>'error')
     is distinct from 'forbidden' then
    raise exception 'FALLO: el contador pagó una factura de proveedor';
  end if;
  if (public.run_payroll('school', a, 2026, 8)->>'error') is distinct from 'forbidden' then
    raise exception 'FALLO: el contador liquidó nómina';
  end if;
  raise notice 'OK: pay_supplier_bill y run_payroll → forbidden';

  select status into v_status from public.payments where id = '00000000-0000-4000-f000-000000000003';
  if v_status <> 'pending' then raise exception 'FALLO: el cobro cambió de estado (%)', v_status; end if;
end $$;

reset role;
rollback;
