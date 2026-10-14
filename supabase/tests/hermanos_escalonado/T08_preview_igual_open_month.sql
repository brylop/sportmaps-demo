-- F2 hermanos · T08: lo que preview_open_month muestra es EXACTAMENTE lo que
-- open_month emite (atleta, monto, descuento de hermanos), con escalones y un
-- vínculo sin cuenta (Avril + Zoe).
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  r jsonb; o jsonb; v_prev int; v_ins int; v_diff int;
begin
  update public.school_settings set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}' where school_id = s;
  perform public._sibling_link_core(s, array['01e2abbe-859e-457a-a538-d6834ad41627'::uuid, 'e4a3c483-0aba-4322-98b5-d97ba790fc22'::uuid], 'ficha', null);

  r := public.preview_open_month(s, 2026, 12);
  o := public.open_month(s, 2026, 12);
  v_prev := (r->>'count')::int;
  v_ins := (o->>'generados')::int;
  if v_prev <> v_ins then raise exception 'FALLO: preview % vs open_month %', v_prev, v_ins; end if;

  with prev as (
    select i->>'athlete' a, (i->>'amount')::numeric m, nullif(i->>'sibling_discount_applied', '')::numeric d
      from jsonb_array_elements(r->'items') i
  ), emit as (
    select substring(p.concept from ' - (.*)$') a, p.amount m, p.sibling_discount_applied d
      from public.payments p
     where p.school_id = s and p.period_year = 2026 and p.period_month = 12 and p.created_at = now()
  )
  select count(*) into v_diff from (
    (select * from prev except select * from emit) union all (select * from emit except select * from prev)
  ) x;
  if v_diff <> 0 then raise exception 'FALLO: % filas difieren entre preview y open_month', v_diff; end if;
  raise notice 'OK: preview = open_month (% cobros); Zoe con vínculo: %', v_ins,
    (select jsonb_build_object('amount', p.amount, 'sib', p.sibling_discount_applied) from public.payments p
      where p.child_id = 'e4a3c483-0aba-4322-98b5-d97ba790fc22' and p.period_year = 2026 and p.period_month = 12);
end $$;
rollback;
