-- Create helper to check demo user without granting access to auth.users
create or replace function public.is_demo_user(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = _user_id
      and u.email like '%@demo.sportmaps.com'
  );
$$;

-- Replace existing demo policy on schools to avoid direct auth.users reference
drop policy if exists "Demo users can view demo schools" on public.schools;

create policy "Demo users can view demo schools"
on public.schools
for select
using (
  is_demo = true and public.is_demo_user(auth.uid())
);
