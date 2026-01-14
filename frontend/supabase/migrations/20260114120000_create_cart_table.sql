-- Create carts table
create table public.carts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  constraint carts_pkey primary key (id),
  constraint carts_user_id_key unique (user_id)
);

-- Enable RLS
alter table public.carts enable row level security;

-- Policies
create policy "Users can view their own cart"
  on public.carts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own cart"
  on public.carts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cart"
  on public.carts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own cart"
  on public.carts for delete
  using (auth.uid() = user_id);

-- Trigger for updated_at
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at before update on public.carts
  for each row execute procedure moddatetime (updated_at);
