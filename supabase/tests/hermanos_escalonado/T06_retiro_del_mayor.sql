-- F2 hermanos · T06: si se retira la mayor (Mariapaz), las demás suben de
-- rango: Athenea pasa a 1.ª (sin descuento) y Bella a 2.ª (5 %).
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  r jsonb; it jsonb;
begin
  update public.school_settings set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}' where school_id = s;
  update public.enrollments set status = 'cancelled' where id = 'a94d0d45-9e54-4c97-a82c-ff9607982ae6';

  if public._sibling_rank(s, '22515123-5f8b-4c19-bf7f-894ad9eac880') <> 1
     or public._sibling_rank(s, '8dd99bb9-3786-4800-9c04-c541ca83486d') <> 2 then
    raise exception 'FALLO: rangos tras el retiro: Athenea %, Bella %',
      public._sibling_rank(s, '22515123-5f8b-4c19-bf7f-894ad9eac880'),
      public._sibling_rank(s, '8dd99bb9-3786-4800-9c04-c541ca83486d');
  end if;

  r := public.preview_open_month(s, 2026, 12);
  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Athenea QA';
  if (it->>'amount')::numeric <> 489000 then raise exception 'FALLO: Athenea % (esperado 489000)', it->>'amount'; end if;
  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Bella QA';
  if (it->>'amount')::numeric <> 1084900 then raise exception 'FALLO: Bella % (esperado 1084900)', it->>'amount'; end if;
  if exists (select 1 from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Mariapaz QA') then
    raise exception 'FALLO: Mariapaz retirada sigue en el preview';
  end if;
  raise notice 'OK: sin Mariapaz → Athenea 489000 (1.ª), Bella 1084900 (2.ª, 5 %%)';
end $$;
rollback;
