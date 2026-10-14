-- F2 hermanos · T09: el cobro de la 3.ª hermana deja en payment_adjustments
-- un ajuste origin 'hermanos' con pct 10 (el % implícito del escalón, no el
-- sibling_discount_percentage = 5 de la escuela) y el de la 2.ª pct 5.
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  a record;
begin
  update public.school_settings set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}' where school_id = s;
  perform public.open_month(s, 2026, 12);

  select adj.origin, adj.pct, adj.amount, adj.basis into a
    from public.payment_adjustments adj join public.payments p on p.id = adj.payment_id
   where p.child_id = '8dd99bb9-3786-4800-9c04-c541ca83486d' and p.period_year = 2026 and p.period_month = 12
     and adj.origin = 'hermanos';
  if a is null or a.pct <> 10 or a.amount <> 114200 or a.basis <> 'porcentaje' then
    raise exception 'FALLO: ajuste de Bella %', a;
  end if;
  raise notice 'OK: Bella (3.ª) → hermanos % % %% $%', a.basis, a.pct, a.amount;

  select adj.origin, adj.pct, adj.amount, adj.basis into a
    from public.payment_adjustments adj join public.payments p on p.id = adj.payment_id
   where p.child_id = '22515123-5f8b-4c19-bf7f-894ad9eac880' and p.period_year = 2026 and p.period_month = 12
     and adj.origin = 'hermanos';
  if a is null or a.pct <> 5 or a.amount <> 24450 then
    raise exception 'FALLO: ajuste de Athenea %', a;
  end if;
  raise notice 'OK: Athenea (2.ª) → hermanos %% % $%', a.pct, a.amount;

  if exists (select 1 from public.payment_adjustments adj join public.payments p on p.id = adj.payment_id
              where p.child_id = '768d7bcd-570e-4728-b6f5-388ade301e92' and p.period_year = 2026
                and p.period_month = 12 and adj.origin = 'hermanos') then
    raise exception 'FALLO: Mariapaz (1.ª) tiene ajuste de hermanos';
  end if;
end $$;
rollback;
