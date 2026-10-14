-- C13b · El reembolso COMPLETADO resta de los ingresos de tienda (en el mes de
-- la venta); uno pendiente no. Parcial 100.000 − 30.000 = 70.000; total
-- 40.000 − 40.000 = 0 (la orden sigue contando como transacción, sin negativos);
-- pendiente de 10.000 sobre una venta de 25.000 → 25.000.
-- Correr:  npm run qa:sql -- supabase/tests/contabilidad_v2/C13b_tienda_reembolso_resta.sql

begin;

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
  ('00000000-0000-4000-c000-0000000013b1', '00000000-0000-4000-a000-000000000004', 100000, 'delivered',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-b000-000000000001', 'wompi', 'tx-c13b-1', '2026-09-10 09:00:00-05', 'C13B-1'),
  ('00000000-0000-4000-c000-0000000013b2', '00000000-0000-4000-a000-000000000004', 40000, 'delivered',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-b000-000000000001', 'wompi', 'tx-c13b-2', '2026-09-11 09:00:00-05', 'C13B-2'),
  ('00000000-0000-4000-c000-0000000013b3', '00000000-0000-4000-a000-000000000004', 25000, 'delivered',
   '00000000-0000-4000-c000-0000000000a1', '00000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-b000-000000000001', 'wompi', 'tx-c13b-3', '2026-09-12 09:00:00-05', 'C13B-3');

-- Antes de reembolsar: 165.000.
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$
declare v numeric;
begin
  select coalesce(sum(income_amount), 0) into v
    from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-09-30');
  if v <> 165000 then raise exception 'FALLO: antes del reembolso la tienda suma % (esperado 165000)', v; end if;
  raise notice 'OK: antes del reembolso 165000';
end $$;
reset role;

-- Reembolsos (como postgres: refunds no se escribe desde el cliente, R16).
-- Pasan por pending → completed, como complete_refund (dispara commerce_refund).
insert into public.refunds (id, order_id, requested_by, reason, refund_amount, refund_pct, status) values
  ('00000000-0000-4000-c000-0000000013f1', '00000000-0000-4000-c000-0000000013b1', '00000000-0000-4000-a000-000000000004', 'talla equivocada', 30000, 30, 'pending'),
  ('00000000-0000-4000-c000-0000000013f2', '00000000-0000-4000-c000-0000000013b2', '00000000-0000-4000-a000-000000000004', 'no llego el pedido', 40000, 100, 'pending'),
  ('00000000-0000-4000-c000-0000000013f3', '00000000-0000-4000-c000-0000000013b3', '00000000-0000-4000-a000-000000000004', 'todavia en revision', 10000, 40, 'pending');
update public.refunds set status = 'completed', processed_at = now()
 where id in ('00000000-0000-4000-c000-0000000013f1', '00000000-0000-4000-c000-0000000013f2');
update public.orders set status = 'partially_refunded' where id = '00000000-0000-4000-c000-0000000013b1';
update public.orders set status = 'refunded'           where id = '00000000-0000-4000-c000-0000000013b2';

select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
set local role authenticated;
do $$
declare r record; v numeric; n int; g numeric; rf numeric;
begin
  for r in select * from public.store_income_lines('00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-09-30') loop
    if r.order_id = '00000000-0000-4000-c000-0000000013b1' and (r.income_amount, r.refunded_amount) <> (70000, 30000) then
      raise exception 'FALLO: parcial → % / % (esperado 70000 / 30000)', r.income_amount, r.refunded_amount;
    elsif r.order_id = '00000000-0000-4000-c000-0000000013b2' and r.income_amount <> 0 then
      raise exception 'FALLO: reembolso total → % (esperado 0)', r.income_amount;
    elsif r.order_id = '00000000-0000-4000-c000-0000000013b3' and r.income_amount <> 25000 then
      raise exception 'FALLO: reembolso PENDIENTE restó: % (esperado 25000)', r.income_amount;
    end if;
  end loop;
  select income_amount, tx_count, gross_amount, refunded_amount into v, n, g, rf
    from public.store_income_summary('00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-09-30', null, 'month')
   where bucket = '2026-09';
  if (v, n, g, rf) <> (95000, 3, 165000, 70000) then
    raise exception 'FALLO: septiembre neto/n/bruto/reembolsado = %/%/%/% (esperado 95000/3/165000/70000)', v, n, g, rf;
  end if;
  select coalesce(sum(income_amount), 0) into v
    from public.finance_income_by_origin('school', '00000000-0000-4000-b000-000000000001', '2026-09-01', '2026-09-30', null, 'total')
   where origin = 'tienda';
  if v <> 95000 then raise exception 'FALLO: by_origin tienda % (esperado 95000)', v; end if;
  raise notice 'OK: reembolso completado resta (parcial y total), el pendiente no: 95000 neto de 165000';
end $$;
reset role;

rollback;
