-- C08 · RPC de escritura como SECURITY DEFINER (M4) — siguen funcionando para el
-- dueño aunque authenticated ya no tenga UPDATE, y ahora SON el control de acceso:
--   · pay_supplier_bill: abono parcial ok, saldo excedido → amount_exceeds_balance,
--     otra escuela → forbidden; deja auditoría con old_data y new_data.
--   · run_payroll / post_payroll_run: cuerpos de 20261003201142 (C1, C2) —
--     1 SMMLV 2026 → intereses 19.992, costo caja 2.289.285; segundo post →
--     idempotent; otra escuela → forbidden (T-11); sin JWT → forbidden (no NULL).
--   · post_payroll_run(run) con UN argumento sigue funcionando (DEFAULT conservado).

begin;

-- sin JWT (service role / cron): can_manage_finances = false → forbidden, nunca pasa
do $$ begin
  if (public.run_payroll('school', '00000000-0000-4000-b000-000000000001', 2026, 8)->>'error') is distinct from 'forbidden' then
    raise exception 'FALLO: run_payroll sin JWT no devolvió forbidden';
  end if;
  if (public.pay_supplier_bill('00000000-0000-4000-9000-000000000011', 1000, current_date)->>'error') is distinct from 'forbidden' then
    raise exception 'FALLO: pay_supplier_bill sin JWT no devolvió forbidden';
  end if;
  raise notice 'OK: sin JWT → forbidden';
end $$;

-- owner B sobre la escuela A (T-11)
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000007','role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (public.run_payroll('school', '00000000-0000-4000-b000-000000000001', 2026, 8)->>'error') is distinct from 'forbidden' then
    raise exception 'FALLO: owner B liquidó la nómina de A';
  end if;
  if (public.pay_supplier_bill('00000000-0000-4000-9000-000000000011', 1000, current_date)->>'error') is distinct from 'forbidden' then
    raise exception 'FALLO: owner B pagó una factura de A';
  end if;
  raise notice 'OK: admin de otra escuela → forbidden en run_payroll y pay_supplier_bill';
end $$;
reset role;

-- owner A
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$
declare
  v jsonb; v_run uuid; v_int numeric; v_exp numeric;
begin
  -- proveedor: abono parcial de 150.000 sobre 400.000
  v := public.pay_supplier_bill('00000000-0000-4000-9000-000000000011', 150000, current_date, 'transfer', 'QA');
  if not (v->>'ok')::boolean or (v->>'amount_paid')::numeric <> 150000 or v->>'status' <> 'partially_paid' then
    raise exception 'FALLO: pay_supplier_bill parcial → %', v;
  end if;
  v := public.pay_supplier_bill('00000000-0000-4000-9000-000000000011', 10000000, current_date);
  if v->>'error' is distinct from 'amount_exceeds_balance' or (v->>'saldo')::numeric <> 250000 then
    raise exception 'FALLO: pago mayor al saldo → %', v;
  end if;
  raise notice 'OK: pay_supplier_bill parcial (saldo 250000) y exceso → amount_exceeds_balance';

  -- nómina agosto 2026: 1 empleado a 1 SMMLV con auxilio
  v := public.run_payroll('school', '00000000-0000-4000-b000-000000000001', 2026, 8);
  if not (v->>'ok')::boolean then raise exception 'FALLO: run_payroll → %', v; end if;
  v_run := (v->>'run_id')::uuid;
  select intereses_cesantias into v_int from public.payroll_items where run_id = v_run;
  if v_int <> 19992 then raise exception 'FALLO C2: intereses de cesantías % (esperado 19992)', v_int; end if;
  if (v->>'cash_cost')::numeric <> 2289285 then raise exception 'FALLO C1: cash_cost % (esperado 2289285)', v->>'cash_cost'; end if;
  raise notice 'OK: run_payroll → intereses 19992, costo caja 2289285 (cuerpos de 20261003201142)';

  v := public.post_payroll_run(v_run);               -- un solo argumento: DEFAULT conservado
  if not (v->>'ok')::boolean or (v->>'amount')::numeric <> 2289285 then
    raise exception 'FALLO: post_payroll_run → %', v;
  end if;
  select amount into v_exp from public.expenses where id = (v->>'expense_id')::uuid and kind = 'payroll';
  if v_exp <> 2289285 then raise exception 'FALLO: egreso de nómina % (esperado 2289285)', v_exp; end if;
  v := public.post_payroll_run(v_run, null);
  if not coalesce((v->>'idempotent')::boolean, false) then raise exception 'FALLO: segundo post no es idempotente → %', v; end if;
  v := public.run_payroll('school', '00000000-0000-4000-b000-000000000001', 2026, 8);
  if v->>'error' is distinct from 'run_locked' then raise exception 'FALLO: recalcular un run pagado → %', v; end if;
  raise notice 'OK: post_payroll_run crea el egreso (2289285), es idempotente y el run pagado queda bloqueado';
end $$;
reset role;

-- auditoría: el pago a proveedor y el run quedaron con old y new
do $$
declare v_n int;
begin
  select count(*) into v_n from public.audit_logs
   where table_name = 'supplier_bills' and action = 'UPDATE' and record_id = '00000000-0000-4000-9000-000000000011'
     and old_data->>'amount_paid' = '0' and new_data->>'amount_paid' = '150000'
     and profile_id = '00000000-0000-4000-a000-000000000001';
  if v_n <> 1 then raise exception 'FALLO: el abono a proveedor no quedó auditado con old/new (% filas)', v_n; end if;
  select count(*) into v_n from public.audit_logs
   where table_name = 'payroll_runs' and action = 'UPDATE' and new_data->>'status' = 'paid' and old_data->>'status' = 'draft';
  if v_n <> 1 then raise exception 'FALLO: el paso a paid del run no quedó auditado (% filas)', v_n; end if;
  raise notice 'OK: audit_logs con old_data/new_data para supplier_bills y payroll_runs';
end $$;

rollback;
