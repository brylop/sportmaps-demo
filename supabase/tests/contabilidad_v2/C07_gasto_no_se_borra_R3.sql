-- C07 · Egresos inmutables (M4; R3 de F0, H13/E-14, C5):
--   · un gasto no se borra ni se edita (ni siquiera el owner) → 42501
--   · solo se insertan gastos 'manual' por PostgREST; payroll/supplier_bill solo por RPC
--   · insertar deja fila en audit_logs con new_data
--   · supplier_bills: sin UPDATE directo; CHECK amount_paid <= amount (23514)
--   · payroll_runs / payroll_items: sin escritura directa
--   · comprobante de gasto (storage) no se borra (U8)

begin;

select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;

do $$
declare
  a constant uuid := '00000000-0000-4000-b000-000000000001';
  v_id uuid;
  v_n int;
begin
  begin
    delete from public.expenses where id = '00000000-0000-4000-9000-000000000021';
    raise exception 'FALLO: el owner borró un gasto';
  exception when insufficient_privilege then raise notice 'OK: delete de gasto → 42501';
  end;
  begin
    update public.expenses set amount = 1 where id = '00000000-0000-4000-9000-000000000021';
    raise exception 'FALLO: el owner editó el monto de un gasto';
  exception when insufficient_privilege then raise notice 'OK: update de gasto → 42501';
  end;
  begin
    insert into public.expenses (owner_type, owner_id, school_id, category_id, kind, status, concept, amount,
                                 expense_date, paid_date, created_by)
    values ('school', a, a, 'cfaf46a1-4652-433a-9402-facde9fddf4b', 'payroll', 'paid', 'nómina a mano', 5000000,
            current_date, current_date, auth.uid());
    raise exception 'FALLO: el owner insertó un egreso de nómina por PostgREST';
  exception when insufficient_privilege then raise notice 'OK: insert kind=payroll → 42501';
  end;

  insert into public.expenses (owner_type, owner_id, school_id, category_id, kind, status, concept, amount,
                               expense_date, paid_date, created_by)
  values ('school', a, a, 'ca62fccf-00a1-42a5-b7b3-225f5381892f', 'manual', 'paid', 'Arriendo QA', 800000,
          current_date, current_date, auth.uid())
  returning id into v_id;
  raise notice 'OK: insert kind=manual permitido (%)', v_id;

  begin
    update public.supplier_bills set amount_paid = amount + 1 where id = '00000000-0000-4000-9000-000000000011';
    raise exception 'FALLO: el owner editó amount_paid de una factura de proveedor';
  exception when insufficient_privilege then raise notice 'OK: update de supplier_bills → 42501';
  end;
  begin
    delete from public.supplier_bills where id = '00000000-0000-4000-9000-000000000011';
    raise exception 'FALLO: el owner borró una factura de proveedor';
  exception when insufficient_privilege then raise notice 'OK: delete de supplier_bills → 42501';
  end;
  begin
    insert into public.supplier_bills (owner_type, owner_id, supplier_id, amount, amount_paid, status, issue_date, due_date, created_by)
    select 'school', a, supplier_id, 1000, 1000, 'paid', current_date, current_date, auth.uid()
      from public.supplier_bills where id = '00000000-0000-4000-9000-000000000011';
    raise exception 'FALLO: se insertó una factura de proveedor ya pagada';
  exception when insufficient_privilege then raise notice 'OK: insert de factura ya pagada → 42501';
  end;
  -- control positivo: factura nueva abierta sin abonos sí entra
  insert into public.supplier_bills (owner_type, owner_id, supplier_id, amount, issue_date, due_date, created_by)
  select 'school', a, supplier_id, 1000, current_date, current_date, auth.uid()
    from public.supplier_bills where id = '00000000-0000-4000-9000-000000000011';
  raise notice 'OK: insert de factura abierta (amount_paid 0) permitido';

  begin
    insert into public.payroll_runs (owner_type, owner_id, period_year, period_month, status, created_by)
    values ('school', a, 2026, 11, 'paid', auth.uid());
    raise exception 'FALLO: el owner insertó un run de nómina directo';
  exception when insufficient_privilege then raise notice 'OK: insert directo en payroll_runs → 42501';
  end;
  begin
    update public.payroll_runs set status = 'draft' where owner_id = a;
    raise exception 'FALLO: el owner reabrió un run de nómina con UPDATE';
  exception when insufficient_privilege then raise notice 'OK: update directo de payroll_runs → 42501 (H13)';
  end;
  begin
    delete from public.payroll_employees where owner_id = a;
    raise exception 'FALLO: el owner borró empleados';
  exception when insufficient_privilege then raise notice 'OK: delete de payroll_employees → 42501 (se desactivan con active=false)';
  end;
  update public.payroll_employees set active = true where owner_id = a;   -- edición permitida
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO: el owner no puede editar su empleado (% filas)', v_n; end if;
  raise notice 'OK: update de payroll_employees sigue permitido';

  begin
    delete from storage.objects where bucket_id = 'accounting-receipts';
    get diagnostics v_n = row_count;
    raise notice 'OK: delete de comprobantes en storage borró % filas (sin policy DELETE: 0 esperado)', v_n;
    if v_n <> 0 then raise exception 'FALLO: se borraron % comprobantes', v_n; end if;
  exception when insufficient_privilege then raise notice 'OK: delete en storage → 42501';
  end;
end $$;
reset role;

-- auditoría con new_data; y el CHECK como postgres (sin grants de por medio)
do $$
declare v_n int;
begin
  select count(*) into v_n from public.audit_logs
   where table_name = 'expenses' and action = 'INSERT' and new_data->>'concept' = 'Arriendo QA'
     and old_data is null and school_id = '00000000-0000-4000-b000-000000000001'
     and profile_id = '00000000-0000-4000-a000-000000000001';
  if v_n <> 1 then raise exception 'FALLO: el insert del gasto no quedó en audit_logs (% filas)', v_n; end if;
  raise notice 'OK: audit_logs registra el INSERT con new_data, escuela y autor';

  begin
    update public.supplier_bills set amount_paid = amount + 1 where id = '00000000-0000-4000-9000-000000000011';
    raise exception 'FALLO: CHECK supplier_bills_paid_le_amount no frenó';
  exception when check_violation then raise notice 'OK: amount_paid > amount → 23514 (CHECK)';
  end;

  -- DELETE como postgres deja old_data (audit_trigger_func lo perdía)
  delete from public.expenses where id = '00000000-0000-4000-9000-000000000022';
  select count(*) into v_n from public.audit_logs
   where table_name = 'expenses' and action = 'DELETE' and record_id = '00000000-0000-4000-9000-000000000022'
     and old_data->>'amount' = '300000' and new_data is null;
  if v_n <> 1 then raise exception 'FALLO: el DELETE no guardó old_data'; end if;
  raise notice 'OK: un DELETE (solo posible como postgres) guarda la fila borrada en old_data';
end $$;

rollback;
