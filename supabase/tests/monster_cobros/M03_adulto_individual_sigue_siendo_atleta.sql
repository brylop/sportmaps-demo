-- M03 · Regresión: la invitación individual de una ficha ADULTA sigue siendo de
-- atleta. El adulto se paga solo: su perfil queda athlete, la ficha se vincula a
-- él y su cobro pasa a user_id (sin crear otra inscripción).
--
-- Correr:  npm run qa:sql -- supabase/tests/monster_cobros
begin;

select set_config('qa.owner',  '00000000-0000-4000-a000-0000000000f1', true);
select set_config('qa.school', '00000000-0000-4000-b000-000000000003', true);
select set_config('qa.team',   '00000000-0000-4000-e000-0000000000f1', true);
select set_config('qa.andres', '00000000-0000-4000-c000-0000000000f3', true);
select set_config('qa.user',   '00000000-0000-4000-a000-0000000000f8', true);
select set_config('qa.y', extract(year  from (now() at time zone 'America/Bogota'))::int::text, true);
select set_config('qa.m', extract(month from (now() at time zone 'America/Bogota'))::int::text, true);

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.open_month(current_setting('qa.school')::uuid, current_setting('qa.y')::int, current_setting('qa.m')::int);
select set_config('qa.inv', public.create_invitation(
    p_email => 'andres.adulto@qa.sportmaps.test', p_role => 'athlete',
    p_child_name => 'Andrés Adulto QA', p_team_id => current_setting('qa.team')::uuid,
    p_monthly_fee => 145000, p_parent_phone => '3001110003', p_branch_id => null,
    p_offering_plan_id => null, p_unregistered_athlete_id => current_setting('qa.andres')::uuid)::text, true);
reset role;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token, is_sso_user, is_anonymous)
values ('00000000-0000-0000-0000-000000000000', current_setting('qa.user')::uuid, 'authenticated', 'authenticated',
        'andres.adulto@qa.sportmaps.test', 'x', now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', 'Andrés Adulto QA', 'role', 'athlete'),
        now(), now(), '', '', '', '', '', '', '', '', false, false);

select set_config('request.jwt.claims',
  json_build_object('sub', current_setting('qa.user'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.accept_invitation_pro(current_setting('qa.inv')::uuid);
reset role;

do $$
declare v_rol text; v_n int;
begin
  select role::text into v_rol from public.profiles where id = current_setting('qa.user')::uuid;
  if v_rol is distinct from 'athlete' then raise exception 'FALLO: el adulto quedó con rol %', v_rol; end if;
  if (select linked_profile_id is distinct from current_setting('qa.user')::uuid
        from public.unregistered_athletes where id = current_setting('qa.andres')::uuid) then
    raise exception 'FALLO: la ficha del adulto no quedó vinculada a su cuenta';
  end if;
  select count(*) into v_n from public.enrollments where user_id = current_setting('qa.user')::uuid and status = 'active';
  if v_n <> 1 then raise exception 'FALLO: el adulto tiene % inscripciones activas (esperado 1)', v_n; end if;
  select count(*) into v_n from public.payments
   where user_id = current_setting('qa.user')::uuid and status = 'pending'
     and period_year = current_setting('qa.y')::int and period_month = current_setting('qa.m')::int;
  if v_n <> 1 then raise exception 'FALLO: el adulto tiene % cobros del mes (esperado 1)', v_n; end if;
  select count(*) into v_n from public.children where full_name = 'Andrés Adulto QA';
  if v_n > 0 then raise exception 'FALLO: el adulto se creó como hijo de alguien'; end if;
  raise notice 'OK: el adulto es athlete, la ficha se vincula y su cobro pasa a user_id';
end $$;

rollback;
