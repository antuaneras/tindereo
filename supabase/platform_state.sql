create table if not exists public.platform_state (
  id text primary key,
  data jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_state enable row level security;

revoke all on public.platform_state from anon, authenticated;
grant all on public.platform_state to service_role;

drop policy if exists "platform_state_no_direct_access" on public.platform_state;
create policy "platform_state_no_direct_access"
  on public.platform_state
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.set_platform_state(next_data jsonb)
returns table (
  id text,
  data jsonb,
  revision bigint,
  updated_at timestamptz
)
language plpgsql
as $$
begin
  insert into public.platform_state (id, data, revision, updated_at)
  values ('main', next_data, 1, timezone('utc', now()))
  on conflict (id) do update
    set data = excluded.data,
        revision = public.platform_state.revision + 1,
        updated_at = timezone('utc', now());

  return query
    select state.id, state.data, state.revision, state.updated_at
    from public.platform_state as state
    where state.id = 'main';
end;
$$;

revoke all on function public.set_platform_state(jsonb) from public, anon, authenticated;
grant execute on function public.set_platform_state(jsonb) to service_role;
alter function public.set_platform_state(jsonb) set search_path = public;
