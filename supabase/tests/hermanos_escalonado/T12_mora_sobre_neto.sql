-- F2 hermanos · T12: la mora (apply_late_fees, 5 % en Dreamers) se calcula
-- sobre el NETO con el descuento de hermanos, no sobre la lista.
-- Bella 3.ª: 1.142.000 − 10 % = 1.027.800 → mora 51.390 (no 57.100).
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  p record;
begin
  update public.school_settings
     set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}',
         late_fee_enabled = true, late_fee_percentage = 5, payment_grace_days = 0
   where school_id = s;
  -- Se libera el período de octubre de Bella y se re-emite con escalones.
  update public.payments set status = 'cancelled'
   where child_id = '8dd99bb9-3786-4800-9c04-c541ca83486d' and period_year = 2026 and period_month = 10
     and status <> 'cancelled';
  perform public.open_month(s, 2026, 10);
  select * into p from public.payments
   where child_id = '8dd99bb9-3786-4800-9c04-c541ca83486d' and period_year = 2026 and period_month = 10
     and status = 'pending';
  if p.amount <> 1027800 then raise exception 'FALLO: octubre de Bella % (esperado 1027800)', p.amount; end if;

  -- Vencido: creado y vencido antes de hoy.
  update public.payments set due_date = '2026-10-05', created_at = '2026-10-01' where id = p.id;
  perform public.apply_late_fees();
  select * into p from public.payments where id = p.id;
  if p.late_fee_amount <> 51390 or p.amount <> 1079190 or p.status <> 'overdue' then
    raise exception 'FALLO: mora % / monto % / estado %', p.late_fee_amount, p.amount, p.status;
  end if;
  raise notice 'OK: mora 51390 sobre el neto 1027800 → 1079190 overdue';
end $$;
rollback;
