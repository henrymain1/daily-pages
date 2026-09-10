-- ============================================================
--  Daily Pages — Weekly AI reflection storage
--  Run this ONCE in Supabase → SQL Editor (New query → paste → Run).
--  Stores one weekly reflection per user (keyed by the Sunday the
--  week ends on) so it isn't regenerated, and remembers whether
--  you've already read it.
-- ============================================================

create table if not exists public.summaries (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  week        date        not null,               -- the Sunday the reflected week ends on
  text        text        not null default '',
  seen        boolean     not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, week)
);

alter table public.summaries enable row level security;

drop policy if exists "read own summaries"   on public.summaries;
drop policy if exists "insert own summaries" on public.summaries;
drop policy if exists "update own summaries" on public.summaries;
drop policy if exists "delete own summaries" on public.summaries;

create policy "read own summaries"   on public.summaries for select using (auth.uid() = user_id);
create policy "insert own summaries" on public.summaries for insert with check (auth.uid() = user_id);
create policy "update own summaries" on public.summaries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own summaries" on public.summaries for delete using (auth.uid() = user_id);
