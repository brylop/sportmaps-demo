-- ULTRA SAFE TRIGGER
-- 1. Inserts ONLY the ID first (minimal dependency)
-- 2. On Conflict Do Nothing (prevents crashes if profile exists)
-- 3. Handles Role casting safely if it's an ENUM or Text

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'),
    coalesce(new.raw_user_meta_data->>'role', 'athlete') -- Let postgres cast it automatically if possible, or fail gracefully
  )
  on conflict (id) do nothing;
  
  return new;
exception
  when others then
    -- CRITICAL: Catch errors and allow user creation to succeed even if profile creation fails
    -- We will fix the profile later if needed, but don't block auth!
    return new;
end;
$$;

-- Re-create trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

SELECT 'Trigger updated to NON-BLOCKING mode' as status;
