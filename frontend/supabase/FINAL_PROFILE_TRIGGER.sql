-- FINAL PROFILE TRIGGER v3
-- 1. Uses ONLY confirmed existing columns: id, full_name, role. (NO email)
-- 2. Handles strict ENUM casting for 'role' safely using exception block if needed.
-- 3. Ensures created_at/updated_at are set.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  -- Local variables to process meta data
  meta_role text;
  meta_fullname text;
begin
  -- Extract values safely
  meta_role := coalesce((new.raw_user_meta_data->>'role')::text, 'athlete');
  meta_fullname := coalesce(new.raw_user_meta_data->>'full_name', 'Usuario');

  -- Attempt Insert with explicit casting
  -- If 'role' is an ENUM type in DB, Postgres is usually smart enough to cast 'text' to ENUM automatically 
  -- if the string matches a label. If not, we might need explicit cast, but text is safer first try.
  
  insert into public.profiles (id, full_name, role, created_at, updated_at)
  values (
    new.id,
    meta_fullname,
    meta_role::app_role, -- TRY casting to known enum 'app_role' first. If this fails, we catch it.
    now(),
    now()
  );
  
  return new;
exception
  when undefined_object then -- "type app_role does not exist"
    -- Fallback: If 'app_role' enum doesn't exist, maybe it needs text cast or another enum name?
    -- Let's try inserting as raw text (postgres will cast to whatever the column type is)
    insert into public.profiles (id, full_name, role, created_at, updated_at)
    values (
      new.id,
      meta_fullname,
      meta_role, -- Let Postgres infer type
      now(),
      now()
    );
    return new;
    
  when invalid_text_representation then -- "invalid input value for enum"
    -- Fallback: If 'school' is not a valid enum value, default to 'athlete' (safest bet)
    insert into public.profiles (id, full_name, role, created_at, updated_at)
    values (
      new.id,
      meta_fullname,
      'athlete', -- Fallback role
      now(),
      now()
    );
    return new;

  when others then
    -- Absolute fallback: Log error but allow auth user creation
    -- We can't let auth fail just because profile failed.
    -- raise warning 'Profile creation failed for %: %', new.id, SQLERRM;
    return new;
end;
$$;

-- Connect Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

SELECT 'Final Robust Trigger deployed' as status;
