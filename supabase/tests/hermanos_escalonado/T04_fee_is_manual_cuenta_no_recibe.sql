-- F2 hermanos · T04: una inscripción con tarifa manual (fee_is_manual) NO
-- recibe el descuento, pero SÍ cuenta para el rango de sus hermanos.
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  r jsonb; it jsonb; q jsonb;
begin
  update public.school_settings set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}' where school_id = s;
  -- Athenea (2.ª) con tarifa manual de 400.000.
  update public.enrollments set fee_is_manual = true, monthly_fee = 400000
   where id = '8dfdab05-51aa-40e8-9183-611c6d6fed8c';

  r := public.preview_open_month(s, 2026, 12);
  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Athenea QA';
  if (it->>'amount')::numeric <> 400000 or it->>'sibling_discount_applied' is not null then
    raise exception 'FALLO: Athenea manual cobra % con descuento %', it->>'amount', it->>'sibling_discount_applied';
  end if;
  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Bella QA';
  if (it->>'amount')::numeric <> 1027800 then
    raise exception 'FALLO: Bella % (esperado 1027800: sigue siendo la 3.ª)', it->>'amount';
  end if;

  q := public.sibling_discount_quote(s, '22515123-5f8b-4c19-bf7f-894ad9eac880');
  if (q->>'pct')::numeric <> 0 or (q->>'rank')::int <> 2 or not (q->>'fee_is_manual')::boolean then
    raise exception 'FALLO: quote de Athenea manual %', q;
  end if;
  raise notice 'OK: Athenea manual 400000 sin descuento, rango 2; Bella 3.ª 1027800; quote %', q;
end $$;
rollback;
