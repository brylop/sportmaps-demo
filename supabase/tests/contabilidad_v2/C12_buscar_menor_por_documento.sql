-- C12 · buscar_menor_por_documento_publico (H-12, mig 20261005133932):
--   · anon + escuela correcta + documento → encuentra la ficha (flujo legítimo),
--     nombre enmascarado, SIN contacto del acudiente (los 3 campos NULL),
--     tanto en children como en unregistered_athletes.
--   · anon + OTRA escuela → 0 filas. school_id inventado → 0 filas.
--   · documento corto (< 5 dígitos) → 0 filas.
--   · padre ajeno (authenticated de B) con la escuela A → misma respuesta recortada.
--   · freno: la búsqueda 21 de la misma IP en 10 min → P0001 RATE_LIMITED;
--     otra IP sigue pasando; el servidor (sin JWT) no cuenta.
--   · anon/authenticated no leen la bitácora (42501); la bitácora guarda hash, no IP.

begin;

-- Fichas libres con contacto precargado por la escuela A
insert into public.children (id, full_name, school_id, doc_number, parent_id,
                             parent_name_temp, parent_email_temp, parent_phone_temp)
values ('00000000-0000-4000-c000-0000000000c2', 'Carlos Sánchez Díaz', '00000000-0000-4000-b000-000000000001',
        '1.098.765.432', null, 'Marta Díaz', 'marta.diaz@gmail.com', '3001234567');
insert into public.unregistered_athletes (id, full_name, school_id, doc_number, guardian_full_name, guardian_email, guardian_phone)
values ('00000000-0000-4000-c000-0000000000c3', 'Luisa Gómez Ruiz', '00000000-0000-4000-b000-000000000001',
        '1122334455', 'Pedro Gómez', 'pedro.gomez@hotmail.com', '3109876543');

-- ── anon ────────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select set_config('request.headers', json_build_object('x-forwarded-for','203.0.113.7, 10.0.0.1')::text, true);
set local role anon;

do $$
declare
  a constant uuid := '00000000-0000-4000-b000-000000000001';
  b constant uuid := '00000000-0000-4000-b000-000000000002';
  r record;
  v_n int;
begin
  select * into r from public.buscar_menor_por_documento_publico('1098765432', a);
  if r.child_id is distinct from '00000000-0000-4000-c000-0000000000c2' then
    raise exception 'FALLO: anon no encuentra la ficha libre en su escuela (flujo legítimo roto)';
  end if;
  if r.nombre <> 'Carlos S. D.' then raise exception 'FALLO: nombre no enmascarado: %', r.nombre; end if;
  if r.parent_name_temp is not null or r.parent_email_temp is not null or r.parent_phone_temp is not null then
    raise exception 'FALLO: anon recibe contacto del acudiente (% / % / %)', r.parent_name_temp, r.parent_email_temp, r.parent_phone_temp;
  end if;
  if r.already_linked or r.source <> 'children' then raise exception 'FALLO: already_linked/source mal'; end if;
  raise notice 'OK: anon + escuela + documento → ficha "%" sin contacto del acudiente', r.nombre;

  select * into r from public.buscar_menor_por_documento_publico('1122334455', a);
  if r.child_id is distinct from '00000000-0000-4000-c000-0000000000c3' or r.source <> 'unregistered_athlete' then
    raise exception 'FALLO: anon no encuentra la ficha importada (unregistered_athletes)';
  end if;
  if r.parent_email_temp is not null or r.parent_phone_temp is not null or r.parent_name_temp is not null then
    raise exception 'FALLO: contacto del acudiente de una ficha importada sale a anon';
  end if;
  raise notice 'OK: ficha importada encontrada, sin guardian_email/phone/name';

  select count(*) into v_n from public.buscar_menor_por_documento_publico('1098765432', b);
  if v_n <> 0 then raise exception 'FALLO: con el school_id de otra escuela devuelve % filas', v_n; end if;
  select count(*) into v_n from public.buscar_menor_por_documento_publico('1098765432', gen_random_uuid());
  if v_n <> 0 then raise exception 'FALLO: school_id inventado devuelve % filas', v_n; end if;
  select count(*) into v_n from public.buscar_menor_por_documento_publico('1098', a);
  if v_n <> 0 then raise exception 'FALLO: documento de 4 dígitos devuelve % filas', v_n; end if;
  select count(*) into v_n from public.buscar_menor_por_documento_publico('1098765432', null);
  if v_n <> 0 then raise exception 'FALLO: sin escuela devuelve % filas', v_n; end if;
  raise notice 'OK: otra escuela / escuela inventada / documento corto / sin escuela → 0 filas';

  begin
    perform 1 from public.public_doc_lookup_attempts;
    raise exception 'FALLO: anon lee la bitácora del freno';
  exception when insufficient_privilege then raise notice 'OK: anon → 42501 en public_doc_lookup_attempts';
  end;
end $$;
reset role;

-- ── padre ajeno (authenticated, escuela B) ─────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub','00000000-0000-4000-a000-000000000005','role','authenticated')::text, true);
select set_config('request.headers', json_build_object('x-forwarded-for','198.51.100.9')::text, true);
set local role authenticated;
do $$
declare r record;
begin
  select * into r from public.buscar_menor_por_documento_publico('1098765432', '00000000-0000-4000-b000-000000000001');
  if r.parent_email_temp is not null or r.parent_phone_temp is not null or r.parent_name_temp is not null then
    raise exception 'FALLO: padre ajeno recibe el contacto del acudiente';
  end if;
  raise notice 'OK: padre ajeno autenticado → misma respuesta recortada (sin contacto)';
  begin
    perform 1 from public.public_doc_lookup_attempts;
    raise exception 'FALLO: authenticated lee la bitácora del freno';
  exception when insufficient_privilege then raise notice 'OK: authenticated → 42501 en la bitácora';
  end;
end $$;
reset role;

-- ── freno de frecuencia ────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select set_config('request.headers', json_build_object('x-forwarded-for','203.0.113.50')::text, true);
set local role anon;
do $$
declare i int; v_n int;
begin
  for i in 1..20 loop
    select count(*) into v_n from public.buscar_menor_por_documento_publico('1098765432', '00000000-0000-4000-b000-000000000001');
  end loop;
  raise notice 'OK: 20 búsquedas seguidas de la misma IP pasan';
  begin
    perform * from public.buscar_menor_por_documento_publico('1098765432', '00000000-0000-4000-b000-000000000001');
    raise exception 'FALLO: la búsqueda 21 de la misma IP no fue frenada';
  exception when raise_exception then
    if sqlerrm not like 'Demasiadas búsquedas%' then raise; end if;
    raise notice 'OK: búsqueda 21 → P0001 "%"', sqlerrm;
  end;
end $$;
-- otra IP no queda bloqueada
select set_config('request.headers', json_build_object('cf-connecting-ip','192.0.2.44')::text, true);
do $$
declare v_n int;
begin
  select count(*) into v_n from public.buscar_menor_por_documento_publico('1098765432', '00000000-0000-4000-b000-000000000001');
  if v_n <> 1 then raise exception 'FALLO: otra IP quedó bloqueada (% filas)', v_n; end if;
  raise notice 'OK: otra IP sigue buscando';
end $$;
reset role;

-- servidor (sin JWT) no cuenta, y la bitácora no guarda la IP en claro
select set_config('request.jwt.claims', '', true);
do $$
declare v_before int; v_after int; v_n int;
begin
  select count(*) into v_before from public.public_doc_lookup_attempts;
  perform * from public.buscar_menor_por_documento_publico('1098765432', '00000000-0000-4000-b000-000000000001');
  select count(*) into v_after from public.public_doc_lookup_attempts;
  if v_after <> v_before then raise exception 'FALLO: la llamada de servidor gastó cupo'; end if;
  select count(*) into v_n from public.public_doc_lookup_attempts where ip_hash like '%203.0.113%';
  if v_n <> 0 then raise exception 'FALLO: la bitácora guarda la IP en claro'; end if;
  select count(*) into v_n from public.public_doc_lookup_attempts where ip_hash = md5('203.0.113.50');
  if v_n <> 20 then raise exception 'FALLO: esperaba 20 intentos registrados de la IP frenada, hay %', v_n; end if;
  raise notice 'OK: servidor sin cupo; bitácora con md5(ip) (20 intentos de la IP frenada, el 21 no se registró)';
end $$;

rollback;
