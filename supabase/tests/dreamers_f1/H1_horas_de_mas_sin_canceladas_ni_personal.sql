-- F1 · Horas de más: generate_hour_bank_overage_suggestions no sugiere cargos
-- a inscripciones canceladas ni a personal de la escuela; sí a una atleta activa.
-- Caso real: $419.188 a la inscripción cancelada 2992a5ee (la dueña, sin cuenta).
-- Migración: 20261013192915_reserve_hour_bank_periodo_de_la_fecha.sql
begin;
do $$
declare
  c_school constant uuid := '57ba9352-2c11-4b5b-aa5b-e5ec6f526cbe';
  c_edna   constant uuid := '2992a5ee-c697-4728-852a-29926b0d725b';  -- cancelada, sin cuenta
  c_adulto constant uuid := '0991e245-2468-4fac-9186-f275b9089f7a';  -- adulto con cuenta
  c_bella  constant uuid := 'bc70f094-ca4d-4b6b-a951-7ed6141aa4ab';  -- menor activa
  c_plan   constant uuid := '392a1665-7801-461e-ab2b-c714c8b41379';  -- PGC16x4 3840 min $1.142.000
  v_r jsonb;
begin
  -- La sugerencia vieja de Edna se borra SOLO dentro de esta transacción para
  -- que el generador vuelva a evaluar ese periodo.
  delete from public.hour_bank_overage_charges where enrollment_id = c_edna;

  -- Adulto con cuenta: inscripción activa + miembro coach activo de la escuela.
  update public.enrollments set status = 'active', offering_plan_id = c_plan where id = c_adulto;
  update public.school_members set status = 'active', role = 'coach'
   where school_id = c_school and profile_id = (select user_id from public.enrollments where id = c_adulto);
  insert into public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes, consumed_minutes)
  values (c_adulto, c_school, '2026-08-01', '2026-08-31', 3840, 4500);

  -- Control positivo: Bella, agosto con consumo por encima.
  insert into public.hour_bank_periods (enrollment_id, school_id, period_start, period_end, included_minutes, consumed_minutes)
  values (c_bella, c_school, '2026-08-01', '2026-08-31', 3840, 4500);

  v_r := public.generate_hour_bank_overage_suggestions();
  raise notice 'generador: %', v_r;

  if exists (select 1 from public.hour_bank_overage_charges where enrollment_id = c_edna) then
    raise exception 'FALLO: volvió a sugerir cargo a la inscripción cancelada de la dueña';
  end if;
  raise notice 'OK: sin sugerencia para 2992a5ee (cancelada)';

  if exists (select 1 from public.hour_bank_overage_charges where enrollment_id = c_adulto) then
    raise exception 'FALLO: sugirió cargo a un coach activo de la escuela';
  end if;
  raise notice 'OK: sin sugerencia para personal (coach activo)';

  if not exists (select 1 from public.hour_bank_overage_charges
                  where enrollment_id = c_bella and status = 'suggested') then
    raise exception 'FALLO: control positivo — no sugirió a Bella (activa, menor)';
  end if;
  raise notice 'OK: Bella sí recibe sugerencia ($%)',
    (select amount from public.hour_bank_overage_charges where enrollment_id = c_bella);

  -- Mismo adulto sin rol de personal: ahora sí se le sugiere.
  update public.school_members set status = 'inactive'
   where school_id = c_school and profile_id = (select user_id from public.enrollments where id = c_adulto);
  -- trg_sync_coach_to_staff le creó ficha en school_staff al volverlo coach: también se da de baja.
  update public.school_staff set status = 'inactive'
   where school_id = c_school
     and (coach_auth_id = (select user_id from public.enrollments where id = c_adulto)
          or lower(email) = 'qa-dl-atleta-adulto@demo.sportmaps.co');
  perform public.generate_hour_bank_overage_suggestions();
  if not exists (select 1 from public.hour_bank_overage_charges where enrollment_id = c_adulto) then
    raise exception 'FALLO: adulto que ya no es personal tampoco recibe sugerencia';
  end if;
  raise notice 'OK: el mismo adulto sin rol de personal sí recibe sugerencia';
end $$;
rollback;
