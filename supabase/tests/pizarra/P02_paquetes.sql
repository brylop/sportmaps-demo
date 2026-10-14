-- P02 (pizarra M2) — permisos de los paquetes de la biblioteca: exercise_packs,
-- school_exercise_packs, training_exercises.pack_id (trigger de alcance) y las RPCs
-- activate_exercise_pack / deactivate_exercise_pack / import_exercise_pack.
-- Correr:  npm run qa:sql -- supabase/tests/pizarra/P02_paquetes.sql
--
-- Equivalente en el gemelo de los casos «Paquetes» de scripts/rls-pruebas-pizarra.mjs
-- (que corre contra la viva y los omite mientras la migración no esté aplicada).
-- Este archivo espera el estado DESPUÉS de 20261013194057 (28 plantillas) y de
-- 20261014121142 (paquetes): es el lugar para probar esa migración antes de
-- aplicarla en la viva.
--
-- Actores (qa_twin.actores): coach.a (táctico), owner.a (admin), admin.a
-- (school_admin, NO táctico pero SÍ admin → puede gestionar paquetes), padre.a,
-- atleta.a, owner.b (staff de B), anon.
begin;

do $$
declare
  ids  jsonb;
  c    record;
  q    text;
  n    int;
  k    text;
  v    text;
  ok   boolean;
  fallos text := '';
  v_id uuid;
begin
  if to_regclass('public.exercise_packs') is null then
    raise exception 'FALLO: falta public.exercise_packs — aplicar 20261014121142_pizarra_paquetes_biblioteca en el gemelo.';
  end if;

  select jsonb_object_agg(alias, user_id) into ids from qa_twin.actores
   where alias in ('coach.a', 'owner.a', 'admin.a', 'padre.a', 'atleta.a', 'owner.b');
  ids := ids || jsonb_build_object(
    'sch_a', (select school_id from qa_twin.actores where alias = 'owner.a'),
    'sch_b', (select school_id from qa_twin.actores where alias = 'owner.b'),
    'pk_sys',  '5b1c0000-0000-4000-8000-000000000001',
    'pk_sys2', '5b1c0000-0000-4000-8000-000000000002');

  -- ── Datos de la migración ─────────────────────────────────────────────────
  if (select count(*) from public.exercise_packs where school_id is null) <> 7 then
    raise exception 'FALLO: se esperaban 7 paquetes del sistema';
  end if;
  if exists (select 1 from public.training_exercises where school_id is null and is_template and pack_id is null) then
    raise exception 'FALLO: hay plantillas del sistema sin paquete';
  end if;
  if (select count(*) from public.training_exercises where pack_id = '5b1c0000-0000-4000-8000-000000000002'
        and sport in ('futbol7', 'futbol5')) <> 3 then
    raise exception 'FALLO: el paquete «Fútbol 7 y fútbol 5» debería tener 3 plantillas (1 F7 + 2 F5)';
  end if;

  -- ── Fixture (postgres) ─────────────────────────────────────────────────────
  insert into public.exercise_packs (school_id, sport, name, created_by)
  values ((ids->>'sch_a')::uuid, 'futbol', 'Paquete QA A', (ids->>'coach.a')::uuid) returning id into v_id;
  ids := ids || jsonb_build_object('pk_a', v_id);
  insert into public.exercise_packs (school_id, sport, name, created_by)
  values ((ids->>'sch_b')::uuid, 'futbol', 'Paquete QA B', (ids->>'owner.b')::uuid) returning id into v_id;
  ids := ids || jsonb_build_object('pk_b', v_id);
  insert into public.training_exercises (school_id, created_by, name)
  values ((ids->>'sch_a')::uuid, (ids->>'coach.a')::uuid, 'Ejercicio QA paquetes') returning id into v_id;
  ids := ids || jsonb_build_object('ex_a', v_id);
  insert into public.school_exercise_packs (school_id, pack_id, activated_by)
  values ((ids->>'sch_a')::uuid, '5b1c0000-0000-4000-8000-000000000001', (ids->>'owner.a')::uuid);

  -- ── Casos: (actor, sql que devuelve n, acepta?) ─ ACEPTA ⇔ sin error y n > 0
  for c in
    select * from (values
      -- Lectura
      ('coach.a',  $q$select count(*)::int from public.exercise_packs where id = '{pk_sys}'$q$, true),
      ('coach.a',  $q$select count(*)::int from public.exercise_packs where id = '{pk_a}'$q$, true),
      ('admin.a',  $q$select count(*)::int from public.exercise_packs where id = '{pk_a}'$q$, true),
      ('coach.a',  $q$select count(*)::int from public.exercise_packs where id = '{pk_b}'$q$, false),
      ('owner.b',  $q$select count(*)::int from public.exercise_packs where id = '{pk_a}'$q$, false),
      ('padre.a',  $q$select count(*)::int from public.exercise_packs$q$, false),
      ('atleta.a', $q$select count(*)::int from public.exercise_packs$q$, false),
      ('anon',     $q$select count(*)::int from public.exercise_packs$q$, false),
      ('coach.a',  $q$select count(*)::int from public.school_exercise_packs where school_id = '{sch_a}'$q$, true),
      ('padre.a',  $q$select count(*)::int from public.school_exercise_packs$q$, false),
      ('owner.b',  $q$select count(*)::int from public.school_exercise_packs where school_id = '{sch_a}'$q$, false),
      ('anon',     $q$select count(*)::int from public.school_exercise_packs$q$, false),
      -- Escritura directa: nunca (solo RPC); los del sistema, de solo lectura
      ('coach.a',  $q$with x as (insert into public.exercise_packs (school_id, sport, name) values ('{sch_a}', 'futbol', 'n') returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (insert into public.exercise_packs (school_id, sport, name) values (null, 'futbol', 'n') returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (update public.exercise_packs set name = 'x' where id = '{pk_sys}' returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (delete from public.exercise_packs where id = '{pk_sys}' returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (update public.exercise_packs set is_active = false where id = '{pk_a}' returning 1) select count(*)::int from x$q$, false),
      ('coach.a',  $q$with x as (insert into public.school_exercise_packs (school_id, pack_id) values ('{sch_a}', '{pk_sys2}') returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (delete from public.school_exercise_packs where school_id = '{sch_a}' returning 1) select count(*)::int from x$q$, false),
      -- Trigger de alcance de pack_id
      ('coach.a',  $q$with x as (insert into public.training_exercises (school_id, created_by, name, pack_id) values ('{sch_a}', '{coach.a}', 'n', '{pk_sys}') returning 1) select count(*)::int from x$q$, false),
      ('coach.a',  $q$with x as (insert into public.training_exercises (school_id, created_by, name, pack_id) values ('{sch_a}', '{coach.a}', 'n', '{pk_b}') returning 1) select count(*)::int from x$q$, false),
      ('coach.a',  $q$with x as (insert into public.training_exercises (school_id, created_by, name, pack_id) values ('{sch_a}', '{coach.a}', 'n', '{pk_a}') returning 1) select count(*)::int from x$q$, true),
      ('coach.a',  $q$with x as (update public.training_exercises set pack_id = '{pk_sys}' where id = '{ex_a}' returning 1) select count(*)::int from x$q$, false),
      -- Activar / desactivar (gate admin ∪ táctico)
      ('coach.a',  $q$select ((public.activate_exercise_pack('{sch_a}', '{pk_sys2}')) ->> 'activated')::boolean::int$q$, true),
      ('admin.a',  $q$select ((public.activate_exercise_pack('{sch_a}', '{pk_sys2}')) ->> 'activated')::boolean::int$q$, true),
      ('owner.a',  $q$select ((public.deactivate_exercise_pack('{sch_a}', '{pk_sys}')) ->> 'pack_id' is not null)::int$q$, true),
      ('coach.a',  $q$select ((public.deactivate_exercise_pack('{sch_a}', '{pk_a}')) ->> 'pack_id' is not null)::int$q$, true),
      ('coach.a',  $q$select ((public.activate_exercise_pack('{sch_b}', '{pk_sys2}')) ->> 'pack_id' is not null)::int$q$, false),
      ('coach.a',  $q$select ((public.activate_exercise_pack('{sch_a}', '{pk_b}')) ->> 'pack_id' is not null)::int$q$, false),
      ('coach.a',  $q$select ((public.deactivate_exercise_pack('{sch_a}', '{pk_b}')) ->> 'pack_id' is not null)::int$q$, false),
      ('owner.b',  $q$select ((public.activate_exercise_pack('{sch_a}', '{pk_sys2}')) ->> 'pack_id' is not null)::int$q$, false),
      ('padre.a',  $q$select ((public.activate_exercise_pack('{sch_a}', '{pk_sys2}')) ->> 'pack_id' is not null)::int$q$, false),
      ('atleta.a', $q$select ((public.activate_exercise_pack('{sch_a}', '{pk_sys2}')) ->> 'pack_id' is not null)::int$q$, false),
      ('anon',     $q$select ((public.activate_exercise_pack('{sch_a}', '{pk_sys2}')) ->> 'pack_id' is not null)::int$q$, false),
      -- Importar (transaccional)
      ('coach.a',  $q$select ((public.import_exercise_pack('{sch_a}', '{"pack":{"name":"QA import","sport":"futbol"},"exercises":[{"name":"a"},{"name":"b","sport":"generico"}]}')) ->> 'exercises')::int$q$, true),
      ('admin.a',  $q$select ((public.import_exercise_pack('{sch_a}', '{"pack":{"name":"QA admin","sport":"futbol"},"exercises":[{"name":"a"}]}')) ->> 'exercises')::int$q$, true),
      ('coach.a',  $q$select ((public.import_exercise_pack('{sch_b}', '{"pack":{"name":"QA ajeno","sport":"futbol"},"exercises":[{"name":"a"}]}')) ->> 'exercises')::int$q$, false),
      ('owner.b',  $q$select ((public.import_exercise_pack('{sch_a}', '{"pack":{"name":"QA ajeno","sport":"futbol"},"exercises":[{"name":"a"}]}')) ->> 'exercises')::int$q$, false),
      ('padre.a',  $q$select ((public.import_exercise_pack('{sch_a}', '{"pack":{"name":"QA padre","sport":"futbol"},"exercises":[{"name":"a"}]}')) ->> 'exercises')::int$q$, false),
      ('anon',     $q$select ((public.import_exercise_pack('{sch_a}', '{"pack":{"name":"QA anon","sport":"futbol"},"exercises":[{"name":"a"}]}')) ->> 'exercises')::int$q$, false),
      ('coach.a',  $q$select ((public.import_exercise_pack('{sch_a}', '{"pack":{"name":"QA atomico","sport":"futbol"},"exercises":[{"name":"bien"},{"name":"mal","sport":"quidditch"}]}')) ->> 'exercises')::int$q$, false),
      ('coach.a',  $q$select ((public.import_exercise_pack('{sch_a}', jsonb_build_object('pack', jsonb_build_object('name', 'QA gigante', 'sport', 'futbol'), 'exercises', (select jsonb_agg(jsonb_build_object('name', 'e' || g)) from generate_series(1, 201) g)))) ->> 'exercises')::int$q$, false),
      ('coach.a',  $q$select ((public.import_exercise_pack('{sch_a}', '{"pack":{"sport":"futbol"},"exercises":[{"name":"a"}]}')) ->> 'exercises')::int$q$, false)
    ) as t(actor, sql, acepta)
  loop
    q := c.sql;
    for k, v in select key, value from jsonb_each_text(ids) loop
      q := replace(q, '{' || k || '}', v);
    end loop;
    begin
      if c.actor = 'anon' then
        perform set_config('request.jwt.claims', '{"role":"anon"}', true);
        perform set_config('role', 'anon', true);
      else
        perform set_config('request.jwt.claims', json_build_object('sub', ids->>c.actor, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
      end if;
      execute q into n;
      raise exception using errcode = 'PZ001', message = coalesce(n, 0)::text;
    exception
      when sqlstate 'PZ001' then ok := sqlerrm::int > 0;
      when others then ok := false;
    end;
    if ok <> c.acepta then
      fallos := fallos || format(E'\n  %s: %s (esperado %s)', c.actor, left(c.sql, 110), case when c.acepta then 'ACEPTAR' else 'RECHAZAR' end);
    else
      raise notice 'OK % %', c.actor, left(c.sql, 90);
    end if;
  end loop;

  if fallos <> '' then
    raise exception 'FALLO:%', fallos;
  end if;
end $$;

rollback;
