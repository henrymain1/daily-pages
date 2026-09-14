-- ============================================================
--  Daily Pages — Lists (dashboard widgets)
--  Run this ONCE in Supabase → SQL Editor (New query → paste → Run).
--  Each row is a custom list shown as a widget on the Lists
--  dashboard; x/y/w/h store its position + size on the grid.
-- ============================================================

create table if not exists public.lists (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  title       text        not null default '',
  items       jsonb       not null default '[]'::jsonb,   -- [{ id, text, done }]
  x           int         not null default 0,
  y           int         not null default 0,
  w           int         not null default 3,
  h           int         not null default 4,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.lists enable row level security;

drop policy if exists "read own lists"   on public.lists;
drop policy if exists "insert own lists" on public.lists;
drop policy if exists "update own lists" on public.lists;
drop policy if exists "delete own lists" on public.lists;

create policy "read own lists"   on public.lists for select using (auth.uid() = user_id);
create policy "insert own lists" on public.lists for insert with check (auth.uid() = user_id);
create policy "update own lists" on public.lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own lists" on public.lists for delete using (auth.uid() = user_id);

create index if not exists lists_user_idx on public.lists (user_id, created_at);
