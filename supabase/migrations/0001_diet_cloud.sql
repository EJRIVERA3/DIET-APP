create table if not exists public.user_settings (
  user_key text primary key,
  display_name text not null default '',
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  user_key text not null,
  day_date date not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_key, day_date)
);

create index if not exists daily_logs_user_date_idx
  on public.daily_logs (user_key, day_date);

alter table public.user_settings enable row level security;
alter table public.daily_logs enable row level security;
