-- F2 hermanos · T01: CHECK de school_settings.sibling_discount_tiers.
-- 1 dimensión, índice desde 1, 1..10 elementos, sin NULL, cada uno en [0, 100].
-- Migración: 20261013192946_hermanos_escalonado_base.sql
begin;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  malo text;
  malos text[] := array[
    '{}',                              -- vacío
    '{1,2,3,4,5,6,7,8,9,10,11}',       -- 11 escalones
    '{5,NULL}',                        -- NULL adentro
    '{-1}',                            -- negativo
    '{101}',                           -- > 100
    '{{5,10},{5,10}}',                 -- 2 dimensiones
    '[2:3]={5,10}'                     -- no arranca en 1
  ];
begin
  foreach malo in array malos loop
    begin
      update public.school_settings set sibling_discount_tiers = malo::numeric[] where school_id = s;
      raise exception 'FALLO: el CHECK aceptó %', malo;
    exception when check_violation then
      raise notice 'OK: rechaza %', malo;
    end;
  end loop;

  update public.school_settings set sibling_discount_tiers = '{5,10}' where school_id = s;
  update public.school_settings set sibling_discount_tiers = '{0,0,0,0,0,0,0,0,0,100}' where school_id = s;
  update public.school_settings set sibling_discount_tiers = null where school_id = s;
  raise notice 'OK: acepta {5,10}, 10 escalones y NULL';
end $$;
rollback;
