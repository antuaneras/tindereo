create table if not exists public.tindereo_auth_accounts (
  id text primary key,
  user_id text not null,
  username text not null,
  username_lower text not null,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists tindereo_auth_accounts_username_lower_idx
  on public.tindereo_auth_accounts (username_lower);

create unique index if not exists tindereo_auth_accounts_user_id_idx
  on public.tindereo_auth_accounts (user_id);

alter table public.tindereo_auth_accounts enable row level security;

revoke all on public.tindereo_auth_accounts from anon, authenticated;
grant all on public.tindereo_auth_accounts to service_role;

drop policy if exists "tindereo_auth_accounts_no_direct_access" on public.tindereo_auth_accounts;
create policy "tindereo_auth_accounts_no_direct_access"
  on public.tindereo_auth_accounts
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

create table if not exists public.tindereo_auth_sessions (
  id text primary key,
  user_id text not null,
  token_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

create unique index if not exists tindereo_auth_sessions_token_hash_idx
  on public.tindereo_auth_sessions (token_hash);

create index if not exists tindereo_auth_sessions_user_id_idx
  on public.tindereo_auth_sessions (user_id);

create index if not exists tindereo_auth_sessions_expires_at_idx
  on public.tindereo_auth_sessions (expires_at);

alter table public.tindereo_auth_sessions enable row level security;

revoke all on public.tindereo_auth_sessions from anon, authenticated;
grant all on public.tindereo_auth_sessions to service_role;

drop policy if exists "tindereo_auth_sessions_no_direct_access" on public.tindereo_auth_sessions;
create policy "tindereo_auth_sessions_no_direct_access"
  on public.tindereo_auth_sessions
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
