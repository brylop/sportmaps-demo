-- FIX: Redefine the trigger function to REMOVE 'email' column which likely does not exist in public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuario'), -- Fallback if name is missing
    coalesce((new.raw_user_meta_data->>'role')::text, 'athlete')::text,
    now(),
    now()
  );
  return new;
exception
  when others then
    -- Log error but don't block user creation if profile fails (optional, but safer for auth)
    -- RAISE WARNING 'Profile creation failed: %', SQLERRM;
    -- For now, let's keep it blocking so we know if it works, but fixed the column issue.
    raise; 
end;
$$;

-- Trigger remains the same, but verifying it exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

SELECT 'Trigger FIXED successfully' as status;
