-- Giterdun: run this once in your Supabase project's SQL Editor.

-- 1. One table holds everything (to-dos, applications, notes, stickers...).
create table if not exists public.items (
  id          text primary key,
  owner       text not null check (owner in ('a', 'b', 'shared')),
  type        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 2. Only signed-in users (the two of you) can read or write.
alter table public.items enable row level security;

drop policy if exists "signed in users can do everything" on public.items;
create policy "signed in users can do everything"
  on public.items for all
  to authenticated
  using (true)
  with check (true);

-- 3. Live updates, so changes show up on the other person's screen.
alter publication supabase_realtime add table public.items;

-- 4. A bucket for sticker images. Public read so <img> tags work; only signed-in users can upload.
insert into storage.buckets (id, name, public)
values ('stickers', 'stickers', true)
on conflict (id) do nothing;

drop policy if exists "signed in users upload stickers" on storage.objects;
create policy "signed in users upload stickers"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'stickers');

drop policy if exists "signed in users delete stickers" on storage.objects;
create policy "signed in users delete stickers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'stickers');
