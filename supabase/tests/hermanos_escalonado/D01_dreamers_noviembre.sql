-- F2 hermanos · Escenario Dreamers: con escalones {5,10}, open_month de
-- noviembre 2026 (orden por antigüedad de la inscripción activa):
--   Mariapaz (27-ago) 1.ª  884.000
--   Athenea  (10-sep) 2.ª  489.000 − 5 %  = 464.550
--   Bella    (13-sep) 3.ª 1.142.000 − 10 % = 1.027.800
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  esperado jsonb := '{"Mariapaz QA":[884000,null],"Athenea QA":[464550,24450],"Bella QA":[1027800,114200]}';
  k text; p record; o jsonb;
begin
  update public.school_settings set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}' where school_id = s;
  o := public.open_month(s, 2026, 11);
  raise notice 'open_month noviembre: %', o;
  for k in select jsonb_object_keys(esperado) loop
    select pay.amount, pay.sibling_discount_applied into p
      from public.payments pay join public.children c on c.id = pay.child_id
     where c.full_name = k and pay.school_id = s and pay.period_year = 2026 and pay.period_month = 11
       and pay.status = 'pending' and pay.payment_category = 'mensualidad';
    if p is null then raise exception 'FALLO: % sin cobro de noviembre (¿ya existía?)', k; end if;
    if p.amount <> (esperado->k->>0)::numeric
       or p.sibling_discount_applied is distinct from (esperado->k->>1)::numeric then
      raise exception 'FALLO: % → % (−%), esperado %', k, p.amount, p.sibling_discount_applied, esperado->k;
    end if;
    raise notice 'OK: % → % (−%)', k, p.amount, coalesce(p.sibling_discount_applied, 0);
  end loop;
end $$;
rollback;
