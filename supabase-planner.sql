-- ============================================================
--  Daily Pages — Planner add-on
--  Run this ONCE in your Supabase project's SQL Editor
--  (SQL Editor → New query → paste all → Run) to enable the
--  day-planner page. Safe to run even after the journal is set up.
-- ============================================================

-- One plan per user per day: a "focus" line + a checklist of tasks.
create table if not exists public.plans (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade default auth.uid(),
  plan_date   date        not null,
  focus       text        not null default '',
  items       jsonb       not null default '[]'::jsonb,   -- [{ id, text, done }]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, plan_date)
);

-- Row Level Security: each user can only touch their own plans.
alter table public.plans enable row level security;

drop policy if exists "read own plans"   on public.plans;
drop policy if exists "insert own plans" on public.plans;
drop policy if exists "update own plans" on public.plans;
drop policy if exists "delete own plans" on public.plans;

create policy "read own plans"   on public.plans
  for select using (auth.uid() = user_id);
create policy "insert own plans" on public.plans
  for insert with check (auth.uid() = user_id);
create policy "update own plans" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own plans" on public.plans
  for delete using (auth.uid() = user_id);

create index if not exists plans_user_date_idx on public.plans (user_id, plan_date desc);
