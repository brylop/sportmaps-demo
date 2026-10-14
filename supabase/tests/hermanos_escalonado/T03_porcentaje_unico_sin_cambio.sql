-- F2 hermanos · T03: sin escalones (tiers NULL) el % único se comporta como
-- hoy (Athletic Soacha 10 %, Escuela Demo 15 %): todo hermano desde el 2.º
-- recibe el mismo %. Se compara, para TODA inscripción activa de menor de
-- cada escuela del gemelo, el predicado VIEJO de open_month (parent_id +
-- inscripción activa más antigua) contra el nuevo (_sibling_rank ≥ 2), con
-- el % único prendido en todas. Sin vínculos school_sibling_links los dos
-- deben coincidir salvo un niño con varias inscripciones (ahora cuenta una vez
-- con la más antigua — T07), que se informa aparte.
begin;
do $$
declare
  v_total int; v_diff int; v_multi int;
  r jsonb; it jsonb;
begin
  update public.school_settings
     set sibling_discount_enabled = true, sibling_discount_percentage = 10, sibling_discount_tiers = null;

  with el as (
    select e.*, c.parent_id
      from public.enrollments e join public.children c on c.id = e.child_id
     where e.status = 'active'
  ), cmp as (
    select el.id, el.child_id, el.school_id,
           (el.parent_id is not null and exists (
              select 1 from public.enrollments e2 join public.children c2 on c2.id = e2.child_id
               where c2.parent_id = el.parent_id and e2.school_id = el.school_id and e2.status = 'active'
                 and e2.child_id <> el.child_id
                 and (e2.created_at < el.created_at or (e2.created_at = el.created_at and e2.child_id < el.child_id)))) as viejo,
           public._sibling_tier_pct(el.school_id, public._sibling_rank(el.school_id, el.child_id)) > 0 as nuevo,
           (select count(*) from public.enrollments x where x.child_id = el.child_id
             and x.school_id = el.school_id and x.status = 'active') > 1 as multi
      from el
  )
  select count(*), count(*) filter (where viejo <> nuevo and not multi), count(*) filter (where viejo <> nuevo and multi)
    into v_total, v_diff, v_multi from cmp;

  raise notice 'inscripciones activas de menores: %, difieren: % (+ % por multi-inscripción)', v_total, v_diff, v_multi;
  if v_diff > 0 then
    raise exception 'FALLO: % inscripciones cambian de descuento con el %% único', v_diff;
  end if;

  -- Montos: el 2.º y el 3.º reciben el mismo 10 %.
  r := public.preview_open_month('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', 2026, 12);
  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Athenea QA';
  if (it->>'amount')::numeric <> 440100 then raise exception 'FALLO: Athenea % (esperado 440100)', it->>'amount'; end if;
  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Bella QA';
  if (it->>'amount')::numeric <> 1027800 then raise exception 'FALLO: Bella % (esperado 1027800)', it->>'amount'; end if;
  select i into it from jsonb_array_elements(r->'items') i where i->>'athlete' = 'Mariapaz QA';
  if (it->>'amount')::numeric <> 884000 then raise exception 'FALLO: Mariapaz % (esperado 884000)', it->>'amount'; end if;
  raise notice 'OK: %% único 10 → Mariapaz 884000 · Athenea 440100 · Bella 1027800';
end $$;
rollback;
