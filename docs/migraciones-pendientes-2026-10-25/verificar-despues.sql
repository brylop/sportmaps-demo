-- Verificación después de aplicar entrenador-deportista-v2-B1-a-B5.sql
-- Solo lectura. Correr completo; cada consulta dice qué debe salir.

-- 1. Las 12 funciones existen (debe salir 12 filas).
select proname, pg_get_function_identity_arguments(oid) as args
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('give_kudos','list_kudos','respond_callup','my_callups','callup_status',
                   'save_match_roster','team_payment_status','mark_report_viewed',
                   'is_linked_unregistered_athlete','my_linked_unregistered_ids',
                   '_callup_subject_account','_calendar_event_kind')
 order by 1;

-- 2. Tablas nuevas con RLS encendido (2 filas, rls = true).
select relname, relrowsecurity as rls
  from pg_class
 where relnamespace = 'public'::regnamespace and relname in ('athlete_kudos','match_callup_responses');

-- 3. Policies nuevas (5 filas, todas SELECT).
select tablename, policyname, cmd
  from pg_policies
 where tablename in ('athlete_kudos','match_callup_responses')
    or policyname like '%linked_athlete';

-- 4. Categorías de aviso: debe incluir 'kudos' y 'match' sin perder las demás.
select pg_get_constraintdef(oid) from pg_constraint where conname = 'notifications_category_check';

-- 5. Título de avisos de calendario: debe decir «partido».
select public._calendar_event_kind('training', 'PARTIDO LIGA PREJUVENIL') as tipo;

-- 6. Nadie anónimo puede ejecutar las RPC (debe salir 0 filas).
select proname from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('give_kudos','list_kudos','respond_callup','my_callups','callup_status','team_payment_status')
   and has_function_privilege('anon', oid, 'EXECUTE');

-- 7. Después, en la terminal del repo:  npm run seguridad:invariantes   (sin CRÍTICAS)
