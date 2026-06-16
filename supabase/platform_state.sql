create table if not exists public.platform_state (
  id text primary key,
  data jsonb not null,
  revision bigint not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.platform_state enable row level security;

revoke all on public.platform_state from anon, authenticated;

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
