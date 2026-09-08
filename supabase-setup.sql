-- ============================================================
--  Daily Pages — Supabase setup
--  Run this ONCE in your project's SQL Editor:
--    Supabase dashboard → SQL Editor → New query → paste all → Run
-- ============================================================

-- 1) The table that stores journal entries (one row per user per day).
create table if not exists public.entries (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  entry_date  date        not null,
  title       text        not null default '',
  content     text        not null default '',
  mood        text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, entry_date)
);

-- 2) Row Level Security: every query is automatically filtered so a
--    logged-in user can ONLY ever touch their own rows. This is what
--    makes it safe to ship the public "anon" key in the website.
alter table public.entries enable row level security;

drop policy if exists "read own entries"   on public.entries;
drop policy if exists "insert own entries" on public.entries;
drop policy if exists "update own entries" on public.entries;
drop policy if exists "delete own entries" on public.entries;

create policy "read own entries"   on public.entries
  for select using (auth.uid() = user_id);

create policy "insert own entries" on public.entries
  for insert with check (auth.uid() = user_id);

create policy "update own entries" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete own entries" on public.entries
  for delete using (auth.uid() = user_id);

-- 3) Index to keep the entries list fast.
create index if not exists entries_user_date_idx
  on public.entries (user_id, entry_date desc);
