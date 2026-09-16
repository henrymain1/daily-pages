-- ============================================================
--  Google Calendar sync — token store
--  Run this once in Supabase → SQL Editor.
-- ============================================================
-- Holds each user's Google OAuth tokens. It is written and read ONLY by the
-- `gcal` Edge Function (which uses the service-role key). RLS is enabled with
-- NO policies, so the browser/anon client can never read these tokens.

create table if not exists public.gcal (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text,
  access_token  text,
  expires_at    timestamptz,
  connected_at  timestamptz not null default now()
);

alter table public.gcal enable row level security;
-- (Intentionally no policies: only the service role — used by the Edge
--  Function — can touch this table. The client checks connection status
--  through the Edge Function, never by reading this table directly.)
