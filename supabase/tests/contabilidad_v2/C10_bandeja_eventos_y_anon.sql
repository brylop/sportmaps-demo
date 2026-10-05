-- C10 · Bandeja contable (M6, U9) y anon (trampa 3):
--   · accounting_emit_event: misma clave + mismo evento → mismo id (idempotente);
--     misma clave + otro payload → 23505 ACCOUNTING_EVENT_CONFLICT.
--   · service_role la puede llamar; authenticated ni lee la bandeja ni emite.
--   · anon: payroll_config, expenses, cash_ledger, accounting_outbox y las RPC → 42501.

begin;

set local role service_role;
do $$
declare v1 uuid; v2 uuid; v_n int;
begin
  v1 := public.accounting_emit_event('order_item', '00000000-0000-4000-d000-0000000000e1', 'commerce_sale',
        'school', '00000000-0000-4000-b000-000000000001',
        '{"gross":119000,"base":100000,"vat":19000,"shipping":0,"net":110000,"currency":"COP","effective_date":"2026-10-04"}',
        'commerce_sale:00000000-0000-4000-d000-0000000000e1');
  v2 := public.accounting_emit_event('order_item', '00000000-0000-4000-d000-0000000000e1', 'commerce_sale',
        'school', '00000000-0000-4000-b000-000000000001',
        '{"gross":119000,"base":100000,"vat":19000,"shipping":0,"net":110000,"currency":"COP","effective_date":"2026-10-04"}',
        'commerce_sale:00000000-0000-4000-d000-0000000000e1');
  if v1 is null or v1 <> v2 then raise exception 'FALLO: reintento con la misma clave dio otro id (% / %)', v1, v2; end if;
  select count(*) into v_n from public.accounting_outbox where idempotency_key = 'commerce_sale:00000000-0000-4000-d000-0000000000e1';
  if v_n <> 1 then raise exception 'FALLO: % filas para una clave', v_n; end if;
  raise notice 'OK: misma clave → mismo id, una sola fila (status %)', (select status from public.accounting_outbox where id = v1);

  begin
    perform public.accounting_emit_event('order_item', '00000000-0000-4000-d000-0000000000e1', 'commerce_sale',
        'school', '00000000-0000-4000-b000-000000000001', '{"gross":1}',
        'commerce_sale:00000000-0000-4000-d000-0000000000e1');
    raise exception 'FALLO: la misma clave con otro payload se aceptó';
  exception when unique_violation then raise notice 'OK: misma clave con otro payload → 23505';
  end;
  begin
    perform public.accounting_emit_event('order_item', '00000000-0000-4000-d000-0000000000e1', 'venta_rara',
        'school', '00000000-0000-4000-b000-000000000001', '{}', 'x:1');
    raise exception 'FALLO: event_kind inválido aceptado';
  exception when check_violation then raise notice 'OK: event_kind fuera del catálogo → 23514';
  end;
end $$;
reset role;

-- authenticated (owner A): ni lee la bandeja ni emite
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform * from public.accounting_outbox;
    raise exception 'FALLO: authenticated lee accounting_outbox';
  exception when insufficient_privilege then raise notice 'OK: authenticated select bandeja → 42501';
  end;
  begin
    perform public.accounting_emit_event('payment', '00000000-0000-4000-f000-000000000001', 'payment_income',
        'school', '00000000-0000-4000-b000-000000000001', '{}', 'payment_income:x');
    raise exception 'FALLO: authenticated emite eventos contables';
  exception when insufficient_privilege then raise notice 'OK: authenticated emit → 42501';
  end;
end $$;
reset role;

-- anon
set local role anon;
do $$
declare t text;
begin
  foreach t in array array['payroll_config','expenses','supplier_bills','payroll_runs','cash_ledger','accounting_outbox','audit_logs'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FALLO: anon lee %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
  raise notice 'OK: anon → 42501 en payroll_config, expenses, supplier_bills, payroll_runs, cash_ledger, accounting_outbox, audit_logs';
  begin
    perform public.can_manage_finances('school', '00000000-0000-4000-b000-000000000001');
    raise exception 'FALLO: anon ejecuta can_manage_finances';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 en can_manage_finances';
  end;
  begin
    perform public.run_payroll('school', '00000000-0000-4000-b000-000000000001', 2026, 8);
    raise exception 'FALLO: anon ejecuta run_payroll';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 en run_payroll';
  end;
end $$;
reset role;

rollback;
