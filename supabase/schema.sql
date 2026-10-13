create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

revoke all on table public.user_state from anon;
grant select, insert, update on table public.user_state to authenticated;

drop policy if exists "Users can read their own state" on public.user_state;
create policy "Users can read their own state"
  on public.user_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own state" on public.user_state;
create policy "Users can create their own state"
  on public.user_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own state" on public.user_state;
create policy "Users can update their own state"
  on public.user_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_user_state_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_state_updated_at on public.user_state;
create trigger set_user_state_updated_at
  before update on public.user_state
  for each row execute function public.set_user_state_updated_at();

create table if not exists public.username_reservations (
  username text primary key,
  user_id uuid unique references auth.users (id) on delete cascade,
  reserved_at timestamptz not null default now(),
  constraint username_reservations_format
    check (username ~ '^[a-z0-9][a-z0-9_.-]{2,19}$')
);

alter table public.username_reservations
  drop constraint if exists username_reservations_user_id_fkey;

alter table public.username_reservations
  add constraint username_reservations_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.username_reservations enable row level security;
revoke all on table public.username_reservations from anon, authenticated;

create or replace function public.reserve_auth_username()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text;
begin
  requested_username := lower(trim(new.raw_user_meta_data->>'username'));
  if requested_username is null or requested_username !~ '^[a-z0-9][a-z0-9_.-]{2,19}$' then
    raise exception 'Username must be 3-20 characters and use only letters, numbers, dots, hyphens, or underscores';
  end if;

  insert into public.username_reservations (username, user_id)
  values (requested_username, new.id);
  return new;
end;
$$;

drop trigger if exists reserve_auth_username on auth.users;
create trigger reserve_auth_username
  after insert on auth.users
  for each row execute function public.reserve_auth_username();

create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public, auth
as $$
  select u.email
  from public.username_reservations r
  join auth.users u on u.id = r.user_id
  where r.username = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.get_login_email(text) from public;
grant execute on function public.get_login_email(text) to anon, authenticated;
