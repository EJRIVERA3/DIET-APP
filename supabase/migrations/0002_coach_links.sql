-- Coach sharing + denormalised daily totals.
--
-- Run after 0001_diet_cloud.sql. The D1 driver creates these tables itself on
-- first use (see app/coach-links.ts, ensureCoachSchema); this file keeps the
-- Supabase driver at parity.

-- ---------------------------------------------------------------------------
-- Flat mirror of the numbers inside daily_logs.payload, so the coach roster is
-- one indexed query instead of parsing every client's full history.
-- Derived data: daily_logs stays the source of truth.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_totals (
  user_key        text not null,
  day_date        date not null,
  kcal            numeric not null default 0,
  protein         numeric not null default 0,
  fat             numeric not null default 0,
  carbs           numeric not null default 0,
  target_kcal     numeric not null default 0,
  target_protein  numeric not null default 0,
  target_fat      numeric not null default 0,
  target_carbs    numeric not null default 0,
  weight          numeric,
  meals_logged    integer not null default 0,
  updated_at      timestamptz not null default now(),
  primary key (user_key, day_date)
);

create index if not exists daily_totals_user_date_idx
  on public.daily_totals (user_key, day_date);

-- ---------------------------------------------------------------------------
-- Consent record joining a coach to a client's data.
--
-- user_key stays null until the client accepts the invite from inside their
-- own app. It is never returned to the coach: a sync key is a read/write
-- bearer token and the client's whole identity, so the coach addresses a
-- client by coach_links.id instead. Revoking flips status and costs the
-- client nothing.
-- ---------------------------------------------------------------------------
create table if not exists public.coach_links (
  id           text primary key,
  coach_id     text not null,
  user_key     text,
  client_label text not null default '',
  status       text not null default 'pending'
                 check (status in ('pending', 'active', 'revoked')),
  invite_code  text not null unique,
  scope        text not null default 'read'
                 check (scope in ('read')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  revoked_at   timestamptz
);

create index if not exists coach_links_coach_idx
  on public.coach_links (coach_id, status);

create index if not exists coach_links_user_idx
  on public.coach_links (user_key, status);

-- A pending invite must not already name a client, and an active link must.
alter table public.coach_links
  drop constraint if exists coach_links_user_key_matches_status;
alter table public.coach_links
  add constraint coach_links_user_key_matches_status
  check (
    (status = 'pending' and user_key is null)
    or (status <> 'pending' and user_key is not null)
  );

alter table public.daily_totals enable row level security;
alter table public.coach_links  enable row level security;

-- NOTE: RLS is enabled with no policies, matching 0001. That denies all access
-- to anon/authenticated roles, and the API currently connects with the service
-- role key, which bypasses RLS entirely -- so today these tables are protected
-- only by the secrecy of that key and of each user's sync key.
--
-- When per-user auth lands, add policies here (client reads own rows; coach
-- reads rows for clients with an active link) and stop using the service role
-- key for user-facing reads. Until then, do not treat RLS as a boundary.
