-- F2 hermanos · T10: la sugerencia de mensualidad de _plan_charge_operation
-- (vía preview_charge_batch, «Nuevo cobro») aplica el escalón a un hermano
-- SIN cuenta de acudiente vinculado por school_sibling_links (antes exigía
-- parent_id). Zoe vinculada con Avril (más antigua) → 2.ª → 5 % de 245.000.
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  owner uuid := '6c0b38bb-5c7c-45f0-99e4-cb543b60ea21';
  ath jsonb := '[{"type":"child","id":"e4a3c483-0aba-4322-98b5-d97ba790fc22"}]';
  lin jsonb := '[{"category":"mensualidad","due_date":"2026-12-05","period":{"year":2026,"month":12}}]';
  r jsonb; it jsonb;
begin
  update public.school_settings set sibling_discount_enabled = true, sibling_discount_tiers = '{5,10}' where school_id = s;

  r := public.preview_charge_batch(s, owner, ath, lin);
  it := r->'items'->0;
  if it->>'sibling_discount_applied' is not null then
    raise exception 'FALLO: sin vínculo Zoe ya traía descuento %', it;
  end if;

  perform public._sibling_link_core(s, array['01e2abbe-859e-457a-a538-d6834ad41627'::uuid, 'e4a3c483-0aba-4322-98b5-d97ba790fc22'::uuid], 'ficha', owner);
  r := public.preview_charge_batch(s, owner, ath, lin);
  it := r->'items'->0;
  if (it->>'sibling_discount_applied')::numeric <> 12250 or (it->>'amount')::numeric <> 232750 then
    raise exception 'FALLO: sugerencia de Zoe vinculada %', jsonb_build_object('amount', it->'amount', 'sib', it->'sibling_discount_applied', 'adj', it->'adjustments');
  end if;
  if not exists (select 1 from jsonb_array_elements(it->'adjustments') x where x->>'origin' = 'hermanos' and (x->>'pct')::numeric = 5) then
    raise exception 'FALLO: falta el ajuste hermanos 5 %% en %', it->'adjustments';
  end if;
  raise notice 'OK: Zoe vinculada → 232750 (−12250, hermanos 5 %%)';
end $$;
rollback;
