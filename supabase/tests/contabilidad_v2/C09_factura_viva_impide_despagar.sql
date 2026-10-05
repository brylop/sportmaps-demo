-- C09 · Guard DIAN (M5; H6, T-07, U5):
--   (a) un cobro 'paid' con factura electrónica viva no sale de 'paid' → 55000
--       PAYMENT_INVOICED, sea quien sea (postgres/BFF o el owner por PostgREST).
--   (b) no se crea una factura de un cobro que no está 'paid' → 55000
--       INVOICE_PAYMENT_NOT_PAID; la nota crédito sí.
--   Pasan: re-aprobar (entrar a 'paid'), des-pagar sin factura, des-pagar con la
--   factura ya anulada (voided_at), y la válvula U5 solo vía la RPC de super admin.

begin;

-- factura aceptada sobre el cobro paid del seed (f…01, escuela A)
insert into public.electronic_invoices (owner_type, owner_id, provider, payment_id, document_type, reference_code, status, number)
values ('school', '00000000-0000-4000-b000-000000000001', 'factus', '00000000-0000-4000-f000-000000000001',
        'invoice', 'QA-FE-1', 'accepted', 'SETP-1');

-- (a) como postgres / BFF
do $$
declare v_n int;
begin
  begin
    update public.payments set status = 'cancelled' where id = '00000000-0000-4000-f000-000000000001';
    raise exception 'FALLO: se des-pagó un cobro facturado (postgres)';
  exception when sqlstate '55000' then raise notice 'OK: postgres paid→cancelled con FE viva → 55000';
  end;
  begin
    update public.payments set status = 'awaiting_approval' where id = '00000000-0000-4000-f000-000000000001';
    raise exception 'FALLO: se devolvió a revisión un cobro facturado';
  exception when sqlstate '55000' then raise notice 'OK: paid→awaiting_approval con FE viva → 55000 (el caso DYTY427)';
  end;
  -- cambiar otra columna sin tocar el estado no dispara el guard
  update public.payments set reference = 'QA-PAY-001b' where id = '00000000-0000-4000-f000-000000000001';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO: el guard bloquea updates que no tocan status'; end if;
  raise notice 'OK: update que no cambia status pasa';
end $$;

-- (a) como owner A por PostgREST ("Rechazar" de PaymentsAutomationPage)
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    update public.payments set status = 'rejected' where id = '00000000-0000-4000-f000-000000000001';
    raise exception 'FALLO: el owner rechazó un cobro facturado';
  exception when sqlstate '55000' then raise notice 'OK: owner paid→rejected con FE viva → 55000';
  end;
end $$;
reset role;

-- (b) factura sobre un cobro no pagado
do $$ begin
  begin
    insert into public.electronic_invoices (owner_type, owner_id, provider, payment_id, document_type, reference_code, status)
    values ('school', '00000000-0000-4000-b000-000000000001', 'factus', '00000000-0000-4000-f000-000000000002',
            'invoice', 'QA-FE-2', 'queued');
    raise exception 'FALLO: se facturó un cobro partial';
  exception when sqlstate '55000' then raise notice 'OK: factura sobre cobro partial → 55000 INVOICE_PAYMENT_NOT_PAID';
  end;
  begin
    insert into public.electronic_invoices (owner_type, owner_id, provider, payment_id, document_type, reference_code, status)
    values ('school', '00000000-0000-4000-b000-000000000001', 'factus', '00000000-0000-4000-f000-000000000003',
            'invoice', 'QA-FE-3', 'queued');
    raise exception 'FALLO: se facturó un cobro pending';
  exception when sqlstate '55000' then raise notice 'OK: factura sobre cobro pending → 55000';
  end;
  -- la nota crédito sí entra (aunque el cobro no esté paid)
  insert into public.electronic_invoices (owner_type, owner_id, provider, payment_id, document_type, reference_code, status)
  values ('school', '00000000-0000-4000-b000-000000000001', 'factus', '00000000-0000-4000-f000-000000000002',
          'credit_note', 'QA-NC-2', 'queued');
  raise notice 'OK: nota crédito sobre cobro no pagado → permitida';
end $$;

-- re-aprobar (entrar a paid) no lo mira el guard; des-pagar sin factura pasa
do $$
declare v_n int;
begin
  update public.payments set status = 'paid', amount_paid = amount where id = '00000000-0000-4000-f000-000000000003';
  update public.payments set status = 'cancelled' where id = '00000000-0000-4000-f000-000000000003';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'FALLO: no se pudo des-pagar un cobro sin factura'; end if;
  raise notice 'OK: pending→paid (re-aprobar) y paid→cancelled SIN factura pasan';

  -- con la factura anulada (nota crédito emitida), ya se puede des-pagar
  update public.electronic_invoices set voided_at = now(), status = 'void' where reference_code = 'QA-FE-1';
  update public.payments set status = 'cancelled' where id = '00000000-0000-4000-f000-000000000001';
  raise notice 'OK: con la factura anulada (voided_at) el cobro se puede anular';
end $$;

rollback;

-- ── U5: válvula de escape auditada (transacción aparte) ──
begin;
insert into public.electronic_invoices (owner_type, owner_id, provider, payment_id, document_type, reference_code, status)
values ('school', '00000000-0000-4000-b000-000000000001', 'factus', '00000000-0000-4000-f000-000000000001',
        'invoice', 'QA-FE-U5', 'accepted');

-- el owner NO puede usarla
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  begin
    perform public.admin_unpay_invoiced_payment('00000000-0000-4000-f000-000000000001', 'cancelled', 'duplicado confirmado por soporte');
    raise exception 'FALLO: el owner usó la válvula de super admin';
  exception when insufficient_privilege then raise notice 'OK: owner → 42501 en admin_unpay_invoiced_payment';
  end;
end $$;
reset role;

-- super admin: motivo corto → 22023; motivo válido → pasa y queda auditado
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000010','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v jsonb;
begin
  begin
    perform public.admin_unpay_invoiced_payment('00000000-0000-4000-f000-000000000001', 'cancelled', 'corto');
    raise exception 'FALLO: aceptó un motivo de menos de 10 caracteres';
  exception when invalid_parameter_value then raise notice 'OK: motivo corto → 22023';
  end;
  v := public.admin_unpay_invoiced_payment('00000000-0000-4000-f000-000000000001', 'cancelled', 'duplicado confirmado por soporte');
  if not (v->>'ok')::boolean or v->>'status' <> 'cancelled' then raise exception 'FALLO: válvula → %', v; end if;
  raise notice 'OK: super admin des-paga con motivo → %', v;
end $$;
reset role;

do $$
declare v_n int;
begin
  select count(*) into v_n from public.audit_logs
   where table_name = 'payments' and action = 'UNPAY_INVOICED'
     and record_id = '00000000-0000-4000-f000-000000000001'
     and new_data->>'reason' = 'duplicado confirmado por soporte';
  if v_n <> 1 then raise exception 'FALLO: la válvula no dejó rastro en audit_logs'; end if;
  if current_setting('sportmaps.allow_unpay_invoiced', true) = 'on' then
    raise exception 'FALLO: la válvula quedó encendida después de la RPC';
  end if;
  raise notice 'OK: válvula auditada y apagada al salir';
end $$;

rollback;
