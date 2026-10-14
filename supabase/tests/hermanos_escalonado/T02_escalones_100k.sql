-- F2 hermanos · T02: escalones {5,10} sobre mensualidad $100.000 →
-- 1.º 100.000 · 2.º 95.000 · 3.º 90.000 · 4.º 90.000 (el último escalón vale
-- para todos los siguientes). Familia: las 3 hermanas por acudiente
-- (Mariapaz, Athenea, Bella) + Avril vinculada sin cuenta (la más nueva).
-- Migraciones: 20261013192946 + 20261013192955.
begin;
do $$
declare
  s  uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  r  jsonb;
  esperado jsonb := '{"Mariapaz QA":100000,"Athenea QA":95000,"Bella QA":90000,"Avril QA":90000}';
  k text;
  it jsonb;
begin
  update public.school_settings
     set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}'
   where school_id = s;
  perform public._sibling_link_core(s, array['8dd99bb9-3786-4800-9c04-c541ca83486d'::uuid,
                                              '01e2abbe-859e-457a-a538-d6834ad41627'::uuid], 'ficha', null);
  update public.enrollments set monthly_fee = 100000
   where id in ('a94d0d45-9e54-4c97-a82c-ff9607982ae6', '8dfdab05-51aa-40e8-9183-611c6d6fed8c',
                'bc70f094-ca4d-4b6b-a951-7ed6141aa4ab', '1442069b-ed63-4f4a-86ee-f5bf92a6a1ab');

  -- Tabla de escalones directa.
  if public._sibling_tier_pct(s, 1) <> 0 or public._sibling_tier_pct(s, 2) <> 5
     or public._sibling_tier_pct(s, 3) <> 10 or public._sibling_tier_pct(s, 7) <> 10 then
    raise exception 'FALLO: _sibling_tier_pct 1..7 = % % % %', public._sibling_tier_pct(s, 1),
      public._sibling_tier_pct(s, 2), public._sibling_tier_pct(s, 3), public._sibling_tier_pct(s, 7);
  end if;

  r := public.preview_open_month(s, 2026, 12);
  for k in select jsonb_object_keys(esperado) loop
    select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = k;
    if it is null then raise exception 'FALLO: % no está en el preview de diciembre', k; end if;
    if (it->>'amount')::numeric <> (esperado->>k)::numeric then
      raise exception 'FALLO: % cobra % (esperado %)', k, it->>'amount', esperado->>k;
    end if;
    raise notice 'OK: % → % (rango %)', k, it->>'amount',
      public._sibling_rank(s, (select id from public.children where full_name = k limit 1));
  end loop;
end $$;
rollback;
