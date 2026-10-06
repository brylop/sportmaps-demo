-- C11 · Anular gasto / factura y editar factura sin pagos (mig 20261005133939, §3.5):
--   void_expense
--     · anon sin EXECUTE (42501); padre miembro, coach, admin de otra escuela y
--       contador → 42501 FINANCE_FORBIDDEN (el contador lee pero no anula).
--     · motivo < 10 caracteres → 22023; inexistente → P0002.
--     · owner anula un gasto manual → status void, motivo/fecha/autor, sale de
--       cash_ledger y de finance_ledger_totals, queda en audit_logs (old paid → new void).
--     · anular dos veces → 55000.
--     · gasto de proveedor: revierte amount_paid y estado de la factura (paid → partially_paid → open).
--     · nómina pagada: anula el run (void) y el período se puede volver a liquidar.
--     · comisión de pasarela (source_payment_id) → 55000.
--   void_supplier_bill: con pagos vivos → 55000; sin pagos → void; pagar una anulada → bill_void.
--   update_supplier_bill: con pagos → 55000; sin pagos → edita; proveedor de otro dueño → 22023;
--     contador → 42501.

begin;

-- contador de la escuela A (solo dentro de esta transacción)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values ('00000000-0000-4000-a000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'contador.a@qa.sportmaps.test', 'x', now(), '{"full_name":"Contador QA"}', '{}', now(), now());
update public.profiles set role = 'accountant' where id = '00000000-0000-4000-a000-0000000000c1';
insert into public.school_members (school_id, profile_id, role, status)
values ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-0000000000c1', 'accountant', 'active');

-- comisión de pasarela creada por el conector (como postgres)
insert into public.expenses (id, owner_type, owner_id, school_id, category_id, kind, status, concept, amount,
                             expense_date, paid_date, source_payment_id, created_by)
values ('00000000-0000-4000-9000-0000000000f1', 'school', '00000000-0000-4000-b000-000000000001',
        '00000000-0000-4000-b000-000000000001', 'ca62fccf-00a1-42a5-b7b3-225f5381892f', 'manual', 'paid',
        'Comisión pasarela · QA', 3500, current_date, current_date, '00000000-0000-4000-f000-000000000001',
        '00000000-0000-4000-a000-000000000004');

-- ── anon ────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
set local role anon;
do $$ begin
  begin
    perform public.void_expense('00000000-0000-4000-9000-000000000021', 'motivo suficientemente largo');
    raise exception 'FALLO: anon anuló un gasto';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 en void_expense';
  end;
  begin
    perform public.void_supplier_bill('00000000-0000-4000-9000-000000000011', 'motivo suficientemente largo');
    raise exception 'FALLO: anon anuló una factura';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 en void_supplier_bill';
  end;
  begin
    perform public.update_supplier_bill('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-9000-000000000001',
                                        'X', 1, current_date, current_date);
    raise exception 'FALLO: anon editó una factura';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 en update_supplier_bill';
  end;
end $$;
reset role;

-- ── padre miembro, coach, owner de otra escuela, contador → 42501 ───────────
create temp table _c11_actores (uid uuid, alias text) on commit drop;
insert into _c11_actores values
  ('00000000-0000-4000-a000-000000000004', 'padre.a (miembro)'),
  ('00000000-0000-4000-a000-000000000005', 'padre.b (ajeno)'),
  ('00000000-0000-4000-a000-000000000003', 'coach.a'),
  ('00000000-0000-4000-a000-000000000007', 'owner.b (otra escuela)'),
  ('00000000-0000-4000-a000-0000000000c1', 'contador.a');
grant select on _c11_actores to authenticated;

do $$
declare r record;
begin
  for r in select * from _c11_actores loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.uid, 'role','authenticated')::text, true);
    set local role authenticated;
    begin
      perform public.void_expense('00000000-0000-4000-9000-000000000021', 'Registrado por error en el mes');
      raise exception 'FALLO: % anuló un gasto de A', r.alias;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.void_supplier_bill('00000000-0000-4000-9000-000000000011', 'Factura duplicada del proveedor');
      raise exception 'FALLO: % anuló una factura de A', r.alias;
    exception when insufficient_privilege then null;
    end;
    begin
      perform public.update_supplier_bill('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-9000-000000000001',
                                          'X-1', 1000, current_date, current_date);
      raise exception 'FALLO: % editó una factura de A', r.alias;
    exception when insufficient_privilege then null;
    end;
    reset role;
    raise notice 'OK: % → 42501 en void_expense, void_supplier_bill y update_supplier_bill', r.alias;
  end loop;
end $$;

-- el contador sigue LEYENDO el gasto (no se le quitó nada)
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-0000000000c1','role','authenticated')::text, true);
set local role authenticated;
do $$ declare v_n int; begin
  select count(*) into v_n from public.expenses where id = '00000000-0000-4000-9000-000000000021' and status = 'paid';
  if v_n <> 1 then raise exception 'FALLO: el contador no ve el gasto intacto'; end if;
  raise notice 'OK: el gasto sigue pagado tras los intentos rechazados y el contador lo lee';
end $$;
reset role;

-- ── owner A ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$
declare
  a constant uuid := '00000000-0000-4000-b000-000000000001';
  v jsonb; v_n int; v_tot_before numeric; v_tot_after numeric;
  e1 uuid; e2 uuid; v_bill record; v_new_bill uuid;
  v_run uuid; v_run2 uuid; v_exp uuid; v_status text;
begin
  -- validaciones
  begin
    perform public.void_expense('00000000-0000-4000-9000-000000000021', '  corto   ');
    raise exception 'FALLO: motivo corto aceptado';
  exception when invalid_parameter_value then raise notice 'OK: motivo < 10 caracteres → 22023';
  end;
  begin
    perform public.void_expense(gen_random_uuid(), 'Motivo largo de prueba');
    raise exception 'FALLO: gasto inexistente no falló';
  exception when no_data_found then raise notice 'OK: gasto inexistente → P0002';
  end;

  -- gasto manual pagado
  select total into v_tot_before from public.finance_ledger_totals('school', a, date_trunc('month', current_date)::date - 400, current_date + 400) where direction = 'expense';
  v := public.void_expense('00000000-0000-4000-9000-000000000021', 'Arriendo registrado dos veces por error');
  if not (v->>'ok')::boolean then raise exception 'FALLO: void_expense → %', v; end if;
  select count(*) into v_n from public.expenses
   where id = '00000000-0000-4000-9000-000000000021' and status = 'void'
     and void_reason = 'Arriendo registrado dos veces por error'
     and voided_by = '00000000-0000-4000-a000-000000000001' and voided_at is not null;
  if v_n <> 1 then raise exception 'FALLO: el gasto no quedó void con motivo/autor/fecha'; end if;
  select count(*) into v_n from public.cash_ledger where id = '00000000-0000-4000-9000-000000000021';
  if v_n <> 0 then raise exception 'FALLO: el gasto anulado sigue en cash_ledger'; end if;
  select total into v_tot_after from public.finance_ledger_totals('school', a, date_trunc('month', current_date)::date - 400, current_date + 400) where direction = 'expense';
  if v_tot_before - v_tot_after <> 1200000 then
    raise exception 'FALLO: los totales del libro no bajaron 1.200.000 (% → %)', v_tot_before, v_tot_after;
  end if;
  raise notice 'OK: owner anula gasto manual → void, motivo, autor; sale del libro (totales −1.200.000)';

  begin
    perform public.void_expense('00000000-0000-4000-9000-000000000021', 'Segunda anulación del mismo gasto');
    raise exception 'FALLO: se anuló dos veces';
  exception when object_not_in_prerequisite_state then raise notice 'OK: gasto ya anulado → 55000';
  end;

  begin
    perform public.void_expense('00000000-0000-4000-9000-0000000000f1', 'Comisión cobrada por error');
    raise exception 'FALLO: se anuló una comisión de pasarela suelta';
  exception when object_not_in_prerequisite_state then raise notice 'OK: comisión de pasarela (source_payment_id) → 55000';
  end;

  -- proveedor: 150.000 + 250.000 = pagada; anular revierte paso a paso
  v := public.pay_supplier_bill('00000000-0000-4000-9000-000000000011', 150000, current_date, 'transfer', 'QA-1');
  e1 := (v->>'expense_id')::uuid;
  v := public.pay_supplier_bill('00000000-0000-4000-9000-000000000011', 250000, current_date, 'cash', 'QA-2');
  e2 := (v->>'expense_id')::uuid;
  if v->>'status' <> 'paid' then raise exception 'FALLO: preparación, factura no quedó paid → %', v; end if;

  begin
    perform public.void_supplier_bill('00000000-0000-4000-9000-000000000011', 'Factura anulada por el proveedor');
    raise exception 'FALLO: se anuló una factura con pagos';
  exception when object_not_in_prerequisite_state then raise notice 'OK: anular factura con pagos → 55000';
  end;
  begin
    perform public.update_supplier_bill('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-9000-000000000001',
                                        'F-EDIT', 999999, current_date, current_date);
    raise exception 'FALLO: se editó una factura con pagos';
  exception when object_not_in_prerequisite_state then raise notice 'OK: editar factura con pagos → 55000';
  end;

  perform public.void_expense(e2, 'Pago en efectivo registrado de más');
  select amount_paid, status::text as status into v_bill from public.supplier_bills where id = '00000000-0000-4000-9000-000000000011';
  if v_bill.amount_paid <> 150000 or v_bill.status <> 'partially_paid' then
    raise exception 'FALLO: tras anular el pago de 250.000 la factura quedó % / %', v_bill.amount_paid, v_bill.status;
  end if;
  raise notice 'OK: anular pago de 250.000 → factura 150.000 abonada (paid → partially_paid)';
  perform public.void_expense(e1, 'Transferencia rechazada por el banco');
  select amount_paid, status::text as status into v_bill from public.supplier_bills where id = '00000000-0000-4000-9000-000000000011';
  if v_bill.amount_paid <> 0 or v_bill.status <> 'open' then
    raise exception 'FALLO: tras anular todos los pagos la factura quedó % / %', v_bill.amount_paid, v_bill.status;
  end if;
  raise notice 'OK: anular el último pago → factura en 0 y abierta';

  -- editar ahora que no tiene pagos
  v := public.update_supplier_bill('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-9000-000000000001',
                                   'F-0099', 420000, current_date - 5, current_date + 25, null, 'corregido el monto');
  select count(*) into v_n from public.supplier_bills
   where id = '00000000-0000-4000-9000-000000000011' and amount = 420000 and invoice_no = 'F-0099'
     and due_date = current_date + 25 and notes = 'corregido el monto';
  if v_n <> 1 then raise exception 'FALLO: update_supplier_bill no editó → %', v; end if;
  raise notice 'OK: editar factura sin pagos (monto, número, fechas, notas)';
  begin
    perform public.update_supplier_bill('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-9000-000000000001',
                                        'F-0099', 420000, current_date, current_date - 1);
    raise exception 'FALLO: vencimiento antes de emisión aceptado';
  exception when invalid_parameter_value then raise notice 'OK: vence antes de emitir → 22023';
  end;

  -- anular la factura sin pagos; pagarla después → bill_void
  v := public.void_supplier_bill('00000000-0000-4000-9000-000000000011', 'El proveedor anuló la factura F-0099');
  select status::text into v_status from public.supplier_bills where id = '00000000-0000-4000-9000-000000000011';
  if v_status <> 'void' then raise exception 'FALLO: factura no quedó void'; end if;
  v := public.pay_supplier_bill('00000000-0000-4000-9000-000000000011', 1000, current_date);
  if v->>'error' is distinct from 'bill_void' then raise exception 'FALLO: se pudo pagar una factura anulada → %', v; end if;
  begin
    perform public.void_supplier_bill('00000000-0000-4000-9000-000000000011', 'Segunda anulación de la factura');
    raise exception 'FALLO: factura anulada dos veces';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    perform public.update_supplier_bill('00000000-0000-4000-9000-000000000011', '00000000-0000-4000-9000-000000000001',
                                        'F', 1, current_date, current_date);
    raise exception 'FALLO: se editó una factura anulada';
  exception when object_not_in_prerequisite_state then null;
  end;
  raise notice 'OK: factura sin pagos anulada; pagarla → bill_void; re-anular / editar → 55000';

  -- nómina pagada: anular el egreso anula el run y libera el período
  v := public.run_payroll('school', a, 2026, 9);
  v_run := (v->>'run_id')::uuid;
  v := public.post_payroll_run(v_run);
  v_exp := (v->>'expense_id')::uuid;
  v := public.void_expense(v_exp, 'Nómina de septiembre liquidada con salario viejo');
  if (v->>'payroll_run_id')::uuid is distinct from v_run then raise exception 'FALLO: void_expense no reportó el run → %', v; end if;
  select status::text into v_status from public.payroll_runs where id = v_run;
  if v_status <> 'void' then raise exception 'FALLO: el run de nómina quedó %', v_status; end if;
  select count(*) into v_n from public.payroll_items where run_id = v_run;
  if v_n < 1 then raise exception 'FALLO: el run anulado perdió sus items'; end if;
  v := public.run_payroll('school', a, 2026, 9);
  v_run2 := (v->>'run_id')::uuid;
  if not (v->>'ok')::boolean or v_run2 = v_run then raise exception 'FALLO: no se pudo re-liquidar el período → %', v; end if;
  raise notice 'OK: anular egreso de nómina → run void (conserva items) y el período se re-liquida en un run nuevo';
end $$;
reset role;

-- proveedor de otro dueño en update_supplier_bill (factura nueva sin pagos)
insert into public.suppliers (id, owner_type, owner_id, name)
values ('00000000-0000-4000-9000-0000000000b9', 'school', '00000000-0000-4000-b000-000000000002', 'Proveedor de B');
insert into public.supplier_bills (id, owner_type, owner_id, supplier_id, amount, issue_date, due_date, created_by)
values ('00000000-0000-4000-9000-0000000000b1', 'school', '00000000-0000-4000-b000-000000000001',
        '00000000-0000-4000-9000-000000000001', 50000, current_date, current_date, '00000000-0000-4000-a000-000000000001');
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000002','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.update_supplier_bill('00000000-0000-4000-9000-0000000000b1', '00000000-0000-4000-9000-0000000000b9',
                                        'X', 50000, current_date, current_date);
    raise exception 'FALLO: se asignó un proveedor de otra escuela';
  exception when invalid_parameter_value then raise notice 'OK: admin.a con proveedor de B → 22023';
  end;
  perform public.void_supplier_bill('00000000-0000-4000-9000-0000000000b1', 'Registrada en la escuela equivocada');
  raise notice 'OK: admin.a (school_admin) anula una factura sin pagos';
end $$;
reset role;

-- auditoría (como postgres)
do $$
declare v_n int;
begin
  select count(*) into v_n from public.audit_logs
   where table_name = 'expenses' and action = 'UPDATE' and record_id = '00000000-0000-4000-9000-000000000021'
     and old_data->>'status' = 'paid' and new_data->>'status' = 'void'
     and new_data->>'void_reason' = 'Arriendo registrado dos veces por error'
     and profile_id = '00000000-0000-4000-a000-000000000001';
  if v_n <> 1 then raise exception 'FALLO: la anulación no quedó en audit_logs (% filas)', v_n; end if;
  select count(*) into v_n from public.audit_logs
   where table_name = 'supplier_bills' and action = 'UPDATE' and record_id = '00000000-0000-4000-9000-000000000011'
     and new_data->>'status' = 'void' and new_data->>'void_reason' is not null;
  if v_n <> 1 then raise exception 'FALLO: la anulación de la factura no quedó en audit_logs'; end if;
  select count(*) into v_n from public.audit_logs
   where table_name = 'payroll_runs' and action = 'UPDATE' and old_data->>'status' = 'paid' and new_data->>'status' = 'void';
  if v_n <> 1 then raise exception 'FALLO: la anulación del run no quedó en audit_logs (% filas)', v_n; end if;
  raise notice 'OK: audit_logs guarda old→new de gasto, factura y run, con motivo y autor';

  begin
    update public.expenses set void_reason = 'corto' where id = '00000000-0000-4000-9000-000000000022';
    raise exception 'FALLO: CHECK de motivo no frenó';
  exception when check_violation then raise notice 'OK: CHECK expenses_void_reason_chk (motivo < 10) → 23514';
  end;
end $$;

rollback;
