create table if not exists public.profiles (
  id text primary key,
  handle text not null,
  handle_lower text not null,
  display_name text not null,
  city text not null default '',
  bio text not null default '',
  avatar_url text,
  cover_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profiles_handle_lower_idx on public.profiles (handle_lower);

create table if not exists public.friendships (
  id text primary key,
  user_a_id text not null references public.profiles(id) on delete cascade,
  user_b_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check (user_a_id <> user_b_id)
);

create unique index if not exists friendships_pair_idx
  on public.friendships (least(user_a_id, user_b_id), greatest(user_a_id, user_b_id));

create table if not exists public.events (
  id text primary key,
  slug text not null unique,
  host_id text not null references public.profiles(id) on delete cascade,
  title text not null,
  summary text not null default '',
  description text not null default '',
  category text not null,
  visibility text not null check (visibility in ('public', 'private')),
  city text not null,
  venue text not null,
  cover_image text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null default 0,
  price_label text not null default '',
  dress_code text not null default '',
  tags_json jsonb not null default '[]'::jsonb,
  rules_json jsonb not null default '[]'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  playlist_url text,
  meeting_point_label text,
  meeting_point_address text,
  meeting_point_lat double precision,
  meeting_point_lng double precision,
  chat_mode text not null default 'open' check (chat_mode in ('open', 'announcements')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists events_host_idx on public.events (host_id);
create index if not exists events_starts_at_idx on public.events (starts_at);

create table if not exists public.event_members (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'rejected', 'waitlisted')),
  requested_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz,
  joined_at timestamptz,
  unique (event_id, user_id)
);

create index if not exists event_members_event_status_idx on public.event_members (event_id, status);
create index if not exists event_members_user_idx on public.event_members (user_id);

create table if not exists public.event_waitlist (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'removed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create table if not exists public.event_cohosts (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create table if not exists public.event_presence (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  arrival_status text not null default 'none' check (arrival_status in ('none', 'going', 'eta20', 'inside')),
  checked_in_at timestamptz,
  checked_in_by_user_id text references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create table if not exists public.event_mutes (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  muted_until timestamptz,
  reason text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create table if not exists public.event_bans (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  reason text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create table if not exists public.event_reports (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  reporter_id text not null references public.profiles(id) on delete cascade,
  target_user_id text references public.profiles(id) on delete set null,
  message_id text,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  resolved_by_user_id text references public.profiles(id) on delete set null
);

create table if not exists public.conversations (
  id text primary key,
  kind text not null check (kind in ('event', 'direct', 'group')),
  owner_id text not null references public.profiles(id) on delete cascade,
  event_id text unique references public.events(id) on delete cascade,
  title text,
  cover_image text,
  chat_mode text not null default 'open' check (chat_mode in ('open', 'announcements')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists conversations_owner_idx on public.conversations (owner_id);
create index if not exists conversations_kind_idx on public.conversations (kind);

create table if not exists public.conversation_members (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'cohost', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  last_read_at timestamptz,
  unique (conversation_id, user_id)
);

create index if not exists conversation_members_user_idx on public.conversation_members (user_id);
create index if not exists conversation_members_conversation_idx on public.conversation_members (conversation_id);

create table if not exists public.media_assets (
  id text primary key,
  owner_id text not null references public.profiles(id) on delete cascade,
  storage_ref text not null,
  preview_url text,
  mime_type text not null,
  purpose text not null check (purpose in ('avatar', 'chat', 'event-cover', 'post', 'story')),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz
);

create table if not exists public.messages (
  id text primary key,
  conversation_id text not null references public.conversations(id) on delete cascade,
  author_id text references public.profiles(id) on delete set null,
  body text not null default '',
  kind text not null check (kind in ('text', 'system', 'media')),
  media_asset_id text references public.media_assets(id) on delete set null,
  thread_root_id text references public.messages(id) on delete set null,
  deleted_at timestamptz,
  deleted_for_everyone boolean not null default false,
  ephemeral_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index if not exists messages_thread_root_idx on public.messages (thread_root_id);

create table if not exists public.message_receipts (
  id text primary key,
  message_id text not null references public.messages(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  unique (message_id, user_id)
);

create table if not exists public.stories (
  id text primary key,
  owner_type text not null check (owner_type in ('user', 'event')),
  owner_id text not null,
  author_id text not null references public.profiles(id) on delete cascade,
  media_asset_id text references public.media_assets(id) on delete set null,
  caption text not null default '',
  duration_ms integer not null default 5000,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

create index if not exists stories_owner_idx on public.stories (owner_type, owner_id, created_at);
create index if not exists stories_expires_idx on public.stories (expires_at);

create table if not exists public.story_views (
  id text primary key,
  story_id text not null references public.stories(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default timezone('utc', now()),
  unique (story_id, user_id)
);

create table if not exists public.posts (
  id text primary key,
  owner_type text not null check (owner_type in ('user', 'event')),
  owner_id text not null,
  author_id text not null references public.profiles(id) on delete cascade,
  media_asset_id text references public.media_assets(id) on delete set null,
  caption text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists posts_owner_idx on public.posts (owner_type, owner_id, created_at);

create table if not exists public.post_likes (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (post_id, user_id)
);

create table if not exists public.post_comments (
  id text primary key,
  post_id text not null references public.posts(id) on delete cascade,
  author_id text not null references public.profiles(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists post_comments_post_created_idx on public.post_comments (post_id, created_at);

insert into public.profiles (
  id,
  handle,
  handle_lower,
  display_name,
  city,
  bio,
  avatar_url,
  cover_url,
  created_at,
  updated_at
)
select
  account.user_id,
  account.username,
  account.username_lower,
  account.username,
  'Madrid',
  '',
  null,
  null,
  account.created_at,
  account.updated_at
from public.tindereo_auth_accounts as account
where not exists (
  select 1
  from public.profiles as profile
  where profile.id = account.user_id
)
on conflict (id) do nothing;

create table if not exists public.notifications (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id text,
  data_json jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at);

create table if not exists public.push_subscriptions (
  id text primary key,
  user_id text not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  expiration_time bigint,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reminder_logs (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  user_id text not null references public.profiles(id) on delete cascade,
  reminder_kind text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id, reminder_kind)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'friendships',
    'events',
    'event_members',
    'event_waitlist',
    'event_cohosts',
    'event_presence',
    'event_mutes',
    'event_bans',
    'event_reports',
    'conversations',
    'conversation_members',
    'media_assets',
    'messages',
    'message_receipts',
    'stories',
    'story_views',
    'posts',
    'post_likes',
    'post_comments',
    'notifications',
    'push_subscriptions',
    'reminder_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_no_direct_access', table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
      table_name || '_no_direct_access',
      table_name
    );
  end loop;
end $$;
