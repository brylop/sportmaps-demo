-- Create a function that will handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, email, created_at, updated_at)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce((new.raw_user_meta_data->>'role')::text, 'athlete')::text, -- Cast explicitly to text then if needed cast to enum
    new.email,
    now(),
    now()
  );
  return new;
end;
$$;

-- Create the trigger on auth.users
-- Drop if exists to avoid errors in repeated runs
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Verification
SELECT 'Trigger created successfully' as status;
