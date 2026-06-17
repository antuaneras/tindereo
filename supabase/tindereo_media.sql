insert into storage.buckets (id, name, public)
values ('tindereo-media', 'tindereo-media', false)
on conflict (id) do nothing;
