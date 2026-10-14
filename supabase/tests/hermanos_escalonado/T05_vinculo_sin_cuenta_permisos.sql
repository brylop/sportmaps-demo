-- F2 hermanos · T05: vínculo de hermanos sin cuenta de acudiente
-- (Avril y Zoe no tienen parent_id). El dueño vincula y desvincula; coach y
-- acudiente reciben 42501; un niño de otra escuela da error; nadie escribe la
-- tabla directo; children.parent_id no se toca; queda auditoría.
begin;

-- ── Dueño (qa-dl-dueno) ──────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '6c0b38bb-5c7c-45f0-99e4-cb543b60ea21', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  s uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  r jsonb; fam jsonb;
begin
  r := public.link_siblings(s, array['01e2abbe-859e-457a-a538-d6834ad41627'::uuid, 'e4a3c483-0aba-4322-98b5-d97ba790fc22'::uuid]);
  if jsonb_array_length(r->'child_ids') <> 2 then raise exception 'FALLO: link_siblings devolvió %', r; end if;
  raise notice 'OK: dueño vincula Avril+Zoe → %', r;

  -- El staff lee la tabla (RLS SELECT).
  if (select count(*) from public.school_sibling_links where school_id = s) <> 2 then
    raise exception 'FALLO: el dueño no ve los vínculos';
  end if;

  fam := public.get_sibling_family(s, 'e4a3c483-0aba-4322-98b5-d97ba790fc22');
  if not exists (select 1 from jsonb_array_elements(fam) f where f->>'full_name' = 'Avril QA' and f->>'via' = 'vinculo') then
    raise exception 'FALLO: get_sibling_family no muestra a Avril por vínculo: %', fam;
  end if;
  raise notice 'OK: familia de Zoe %', fam;

  -- Escritura directa prohibida.
  begin
    insert into public.school_sibling_links (school_id, child_id, group_id) values (s, '01957429-c57d-4b96-9285-3eb340a2c1ef', gen_random_uuid());
    raise exception 'FALLO: el dueño insertó directo en school_sibling_links';
  exception when insufficient_privilege then raise notice 'OK: INSERT directo 42501';
  end;

  -- Otra escuela.
  begin
    perform public.link_siblings(s, array['01e2abbe-859e-457a-a538-d6834ad41627'::uuid, '00000000-0000-4000-c000-000000000001'::uuid]);
    raise exception 'FALLO: vinculó un niño de otra escuela';
  exception when invalid_parameter_value then raise notice 'OK: otra escuela → %', sqlerrm;
  end;
end $$;
reset role;

-- ── Coach (qa-dl-coach) ──────────────────────────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '2dddf167-e2e5-4489-a98b-bcd37ebf8d13', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.link_siblings('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe',
      array['01957429-c57d-4b96-9285-3eb340a2c1ef'::uuid, 'e4a3c483-0aba-4322-98b5-d97ba790fc22'::uuid]);
    raise exception 'FALLO: el coach vinculó hermanos';
  exception when insufficient_privilege then raise notice 'OK: coach link 42501';
  end;
  begin
    perform public.unlink_sibling('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', 'e4a3c483-0aba-4322-98b5-d97ba790fc22');
    raise exception 'FALLO: el coach desvinculó';
  exception when insufficient_privilege then raise notice 'OK: coach unlink 42501';
  end;
end $$;
reset role;

-- ── Acudiente (qa-dl-acudiente1) ─────────────────────────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '0fca0e19-2b6c-43ca-a727-25cdb65bd1cc', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    perform public.link_siblings('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe',
      array['8dd99bb9-3786-4800-9c04-c541ca83486d'::uuid, 'e4a3c483-0aba-4322-98b5-d97ba790fc22'::uuid]);
    raise exception 'FALLO: el acudiente vinculó hermanos';
  exception when insufficient_privilege then raise notice 'OK: acudiente link 42501';
  end;
  if (select count(*) from public.school_sibling_links) <> 0 then
    raise exception 'FALLO: el acudiente lee school_sibling_links';
  end if;
  begin
    perform public.get_sibling_family('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', '8dd99bb9-3786-4800-9c04-c541ca83486d');
    raise exception 'FALLO: el acudiente leyó get_sibling_family';
  exception when insufficient_privilege then raise notice 'OK: acudiente get_sibling_family 42501';
  end;
end $$;
reset role;

-- ── Dueño desvincula; parent_id intacto; auditoría ───────────────────────────
select set_config('request.jwt.claims',
  json_build_object('sub', '6c0b38bb-5c7c-45f0-99e4-cb543b60ea21', 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.unlink_sibling('57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe', 'e4a3c483-0aba-4322-98b5-d97ba790fc22');
  if not (r->>'removed')::boolean then raise exception 'FALLO: unlink %', r; end if;
  raise notice 'OK: dueño desvincula %', r;
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.school_sibling_links where school_id = '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe') then
    raise exception 'FALLO: quedó un grupo de un solo niño';
  end if;
  if exists (select 1 from public.children where id in ('01e2abbe-859e-457a-a538-d6834ad41627', 'e4a3c483-0aba-4322-98b5-d97ba790fc22') and parent_id is not null) then
    raise exception 'FALLO: se escribió children.parent_id';
  end if;
  if (select count(*) from public.audit_logs where table_name = 'school_sibling_links'
        and action in ('link_siblings', 'unlink_sibling') and created_at >= now()) <> 2 then
    raise exception 'FALLO: auditoría (esperadas 2 filas)';
  end if;
  raise notice 'OK: grupo de 1 borrado, parent_id intacto, 2 filas de auditoría';
end $$;
rollback;
