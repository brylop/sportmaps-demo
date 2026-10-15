-- F2 hermanos · T15: invariantes_seguridad() sin CRÍTICAS sobre los objetos
-- nuevos (school_sibling_links y funciones _sibling_* / link / unlink /
-- get_sibling_family / sibling_discount_quote). Las críticas preexistentes del
-- gemelo, si las hay, se informan.
begin;
do $$
declare
  v_nuevas int; v_total int; r record;
begin
  select count(*) into v_total from public.invariantes_seguridad() i where i.gravedad ilike 'CR%';
  select count(*) into v_nuevas from public.invariantes_seguridad() i
   where i.objeto ilike '%sibling%';
  for r in select * from public.invariantes_seguridad() i where i.objeto ilike '%sibling%' loop
    raise notice 'sobre objeto nuevo: % % % %', r.invariante, r.gravedad, r.objeto, r.detalle;
  end loop;
  raise notice 'críticas totales en el gemelo: %', v_total;
  if v_nuevas > 0 then raise exception 'FALLO: % hallazgos sobre los objetos de F2', v_nuevas; end if;
  raise notice 'OK: 0 hallazgos sobre los objetos de F2';
end $$;
rollback;
