create table if not exists public.tindereo_group_messages (
  id text primary key,
  event_id text not null,
  author_id text not null,
  text text not null,
  kind text not null check (kind in ('text', 'system')),
  created_at timestamptz not null
);

create index if not exists tindereo_group_messages_event_id_created_at_idx
  on public.tindereo_group_messages (event_id, created_at);

create table if not exists public.tindereo_private_messages (
  id text primary key,
  chat_id text not null,
  author_id text not null,
  text text not null,
  created_at timestamptz not null
);

create index if not exists tindereo_private_messages_chat_id_created_at_idx
  on public.tindereo_private_messages (chat_id, created_at);

alter table public.tindereo_group_messages enable row level security;
alter table public.tindereo_private_messages enable row level security;

revoke all on public.tindereo_group_messages from anon, authenticated;
revoke all on public.tindereo_private_messages from anon, authenticated;

grant all on public.tindereo_group_messages to service_role;
grant all on public.tindereo_private_messages to service_role;

drop policy if exists "tindereo_group_messages_no_direct_access" on public.tindereo_group_messages;
create policy "tindereo_group_messages_no_direct_access"
  on public.tindereo_group_messages
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "tindereo_private_messages_no_direct_access" on public.tindereo_private_messages;
create policy "tindereo_private_messages_no_direct_access"
  on public.tindereo_private_messages
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
