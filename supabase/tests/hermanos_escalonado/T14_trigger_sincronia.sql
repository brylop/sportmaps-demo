-- F2 hermanos · T14: trigger de sincronía tiers[1] <-> sibling_discount_percentage.
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  r record;
begin
  -- Cambian los escalones → el % único pasa a ser tiers[1].
  update public.school_settings set sibling_discount_percentage = 3, sibling_discount_tiers = '{5,10}' where school_id = s;
  select sibling_discount_percentage p, sibling_discount_tiers t into r from public.school_settings where school_id = s;
  if r.p <> 5 or r.t <> '{5,10}'::numeric[] then raise exception 'FALLO: tiers→pct %', r; end if;

  -- Cambia solo el % (pantalla vieja) con escalones → tiers[1].
  update public.school_settings set sibling_discount_percentage = 7 where school_id = s;
  select sibling_discount_percentage p, sibling_discount_tiers t into r from public.school_settings where school_id = s;
  if r.p <> 7 or r.t <> '{7,10}'::numeric[] then raise exception 'FALLO: pct→tiers %', r; end if;

  -- Se borran los escalones → el % queda como estaba (vuelve el % único).
  update public.school_settings set sibling_discount_tiers = null where school_id = s;
  select sibling_discount_percentage p, sibling_discount_tiers t into r from public.school_settings where school_id = s;
  if r.p <> 7 or r.t is not null then raise exception 'FALLO: tiers NULL %', r; end if;

  -- Sin escalones, cambiar el % no inventa escalones.
  update public.school_settings set sibling_discount_percentage = 12 where school_id = s;
  select sibling_discount_percentage p, sibling_discount_tiers t into r from public.school_settings where school_id = s;
  if r.p <> 12 or r.t is not null then raise exception 'FALLO: pct sin tiers %', r; end if;

  -- Los dos a la vez: mandan los escalones.
  update public.school_settings set sibling_discount_percentage = 1, sibling_discount_tiers = '{4,8,12}' where school_id = s;
  select sibling_discount_percentage p, sibling_discount_tiers t into r from public.school_settings where school_id = s;
  if r.p <> 4 then raise exception 'FALLO: ambos %', r; end if;
  raise notice 'OK: sincronía en los 5 casos';
end $$;
rollback;
