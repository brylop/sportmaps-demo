-- P01 (pizarra TacticalPad) — permisos de training_exercises, tactical_board_events
-- y las RPCs insert_exercise_into_session_block / log_tactical_board_event.
-- Correr:  npm run qa:sql -- supabase/tests/pizarra/P01_permisos_biblioteca_metricas.sql
--
-- Equivalente en el gemelo de scripts/rls-pruebas-pizarra.mjs (que corre contra la
-- viva). Este archivo espera el estado DESPUÉS de 20261013200604 (H1/H2/H3
-- cerrados) y de 20261005173002 (lectura táctica solo staff): es el lugar para
-- probar esas migraciones antes de aplicarlas en la viva.
--
-- Actores (qa_twin.actores): coach.a (táctico), owner.a (admin), admin.a
-- (school_admin, NO táctico), padre.a, atleta.a, owner.b (staff de B), anon.
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
  select jsonb_object_agg(alias, user_id) into ids from qa_twin.actores
   where alias in ('coach.a', 'owner.a', 'admin.a', 'padre.a', 'atleta.a', 'owner.b');
  ids := ids || jsonb_build_object(
    'sch_a', (select school_id from qa_twin.actores where alias = 'owner.a'),
    'sch_b', (select school_id from qa_twin.actores where alias = 'owner.b'));

  -- ── Fixture (postgres) ─────────────────────────────────────────────────────
  insert into public.teams (id, name, sport, school_id) values
    ('00000000-0000-4000-e000-0000000000a7', 'Pizarra QA A', 'futbol', (ids->>'sch_a')::uuid),
    ('00000000-0000-4000-e000-0000000000a8', 'Pizarra QA B', 'futbol', (ids->>'sch_b')::uuid);
  insert into public.training_sessions (id, school_id, team_id, session_date, objectives) values
    ('00000000-0000-4000-e000-0000000000d7', (ids->>'sch_a')::uuid, '00000000-0000-4000-e000-0000000000a7', current_date, 'QA pizarra'),
    ('00000000-0000-4000-e000-0000000000d8', (ids->>'sch_b')::uuid, '00000000-0000-4000-e000-0000000000a8', current_date, 'QA pizarra');
  insert into public.training_exercises (school_id, created_by, name, is_template)
  values (null, null, 'Plantilla QA', true) returning id into v_id;
  ids := ids || jsonb_build_object('ex_tpl', v_id);
  insert into public.training_exercises (school_id, created_by, name)
  values ((ids->>'sch_a')::uuid, (ids->>'coach.a')::uuid, 'Ejercicio QA coach') returning id into v_id;
  ids := ids || jsonb_build_object('ex_a', v_id);
  insert into public.training_exercises (school_id, created_by, name)
  values ((ids->>'sch_b')::uuid, (ids->>'owner.b')::uuid, 'Ejercicio QA B') returning id into v_id;
  ids := ids || jsonb_build_object('ex_b', v_id);
  insert into public.tactical_board_events (school_id, user_id, event, created_at)
  values ((ids->>'sch_a')::uuid, (ids->>'coach.a')::uuid, 'open', now() - interval '1 day');

  -- ── Casos: (actor, sql que devuelve n, acepta?) ─ ACEPTA ⇔ sin error y n > 0
  for c in
    select * from (values
      ('coach.a',  $q$select count(*)::int from public.training_exercises where id = '{ex_tpl}'$q$, true),
      ('padre.a',  $q$select count(*)::int from public.training_exercises where id = '{ex_tpl}'$q$, false),   -- H2
      ('atleta.a', $q$select count(*)::int from public.training_exercises where id = '{ex_tpl}'$q$, false),   -- H2
      ('coach.a',  $q$select count(*)::int from public.training_exercises where id = '{ex_b}'$q$, false),
      ('padre.a',  $q$select count(*)::int from public.training_exercises where school_id = '{sch_a}'$q$, false),
      ('anon',     $q$select count(*)::int from public.training_exercises$q$, false),
      ('coach.a',  $q$with x as (insert into public.training_exercises (school_id, created_by, name) values ('{sch_a}', '{coach.a}', 'n') returning 1) select count(*)::int from x$q$, true),
      ('padre.a',  $q$with x as (insert into public.training_exercises (school_id, created_by, name) values ('{sch_a}', '{padre.a}', 'n') returning 1) select count(*)::int from x$q$, false),
      ('owner.b',  $q$with x as (insert into public.training_exercises (school_id, created_by, name) values ('{sch_a}', '{owner.b}', 'n') returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (insert into public.training_exercises (school_id, created_by, name, is_template) values (null, '{owner.a}', 'n', true) returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (update public.training_exercises set name = 'x' where id = '{ex_tpl}' returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (delete from public.training_exercises where id = '{ex_tpl}' returning 1) select count(*)::int from x$q$, false),
      ('coach.a',  $q$with x as (update public.training_exercises set created_by = '{owner.a}' where id = '{ex_a}' returning 1) select count(*)::int from x$q$, false),  -- H3
      ('owner.a',  $q$with x as (update public.training_exercises set name = 'x' where id = '{ex_a}' returning 1) select count(*)::int from x$q$, true),
      ('padre.a',  $q$with x as (delete from public.training_exercises where id = '{ex_a}' returning 1) select count(*)::int from x$q$, false),
      ('owner.a',  $q$with x as (delete from public.training_exercises where id = '{ex_a}' returning 1) select count(*)::int from x$q$, true),
      ('coach.a',  $q$with x as (insert into public.tactical_board_events (school_id, event) values ('{sch_a}', 'open') returning 1) select count(*)::int from x$q$, false),
      ('coach.a',  $q$select public.log_tactical_board_event('{sch_a}', 'save')::int$q$, true),
      ('coach.a',  $q$select public.log_tactical_board_event('{sch_b}', 'save')::int$q$, false),
      ('padre.a',  $q$select public.log_tactical_board_event('{sch_a}', 'save')::int$q$, false),
      ('anon',     $q$select public.log_tactical_board_event('{sch_a}', 'save')::int$q$, false),
      ('coach.a',  $q$select count(*)::int from public.tactical_board_events$q$, false),
      ('owner.a',  $q$select count(*)::int from public.tactical_board_events where school_id = '{sch_a}'$q$, true),
      ('coach.a',  $q$select ((public.insert_exercise_into_session_block('{ex_tpl}', '00000000-0000-4000-e000-0000000000d7', gen_random_uuid(), null)) ->> 'lineup_id' is not null)::int$q$, true),
      ('coach.a',  $q$select ((public.insert_exercise_into_session_block('{ex_tpl}', '00000000-0000-4000-e000-0000000000d8', gen_random_uuid(), null)) ->> 'lineup_id' is not null)::int$q$, false),
      ('coach.a',  $q$select ((public.insert_exercise_into_session_block('{ex_b}', '00000000-0000-4000-e000-0000000000d7', gen_random_uuid(), null)) ->> 'lineup_id' is not null)::int$q$, false),
      ('padre.a',  $q$select ((public.insert_exercise_into_session_block('{ex_tpl}', '00000000-0000-4000-e000-0000000000d7', gen_random_uuid(), null)) ->> 'lineup_id' is not null)::int$q$, false),
      ('admin.a',  $q$select ((public.insert_exercise_into_session_block('{ex_tpl}', '00000000-0000-4000-e000-0000000000d7', gen_random_uuid(), null)) ->> 'lineup_id' is not null)::int$q$, false),  -- H1
      ('anon',     $q$select ((public.insert_exercise_into_session_block('{ex_tpl}', '00000000-0000-4000-e000-0000000000d7', gen_random_uuid(), null)) ->> 'lineup_id' is not null)::int$q$, false)
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
