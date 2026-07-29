-- The Circuit Year: initial schema.
-- Run in the Supabase SQL editor (or supabase db push).

create extension if not exists pgcrypto;

create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  series text,
  producer text,
  city text,
  country text,
  airport_code text,
  venue text,
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  category text not null default 'other'
    check (category in ('circuit','sex_positive','fetish','cruise','pride','edm','other')),
  status text not null default 'announced'
    check (status in ('rumored','announced','on_sale','sold_out','past','cancelled')),
  ticket_url text,
  price_low numeric,
  price_high numeric,
  currency text,
  description text,
  source_url text,
  source_type text check (source_type in ('paste','crawl','manual')),
  relevance_score int check (relevance_score between 0 and 100),
  relevance_reason text,
  confidence text not null default 'high' check (confidence in ('high','medium','low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rsvps (
  event_id uuid primary key references events(id) on delete cascade,
  state text not null default 'undecided' check (state in ('going','skip','undecided')),
  updated_at timestamptz not null default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  depart_date date not null,
  return_date date not null,
  buffer_days int not null default 2,
  pto_days numeric,
  notes text,
  event_ids uuid[] not null default '{}'
);

create table deadlines (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  kind text not null
    check (kind in ('on_sale','book_flight','book_hotel','resale_watch','decide_by','custom')),
  due_date date not null,
  note text,
  done boolean not null default false
);

create table settings (
  id int primary key default 1 check (id = 1),
  pto_annual numeric not null default 20,
  pto_used numeric not null default 0,
  home_airport text not null default 'SEA',
  company_holidays date[] not null default '{}',
  taste_profile jsonb,
  ics_token uuid not null default gen_random_uuid()
);

-- Sources table for the Phase 3 crawler; seeded now, consumed later.
create table sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  name text,
  kind text not null default 'listing',
  enabled boolean not null default true,
  etag text,
  last_checked_at timestamptz
);

create index events_start_date_idx on events (start_date);
create index deadlines_due_date_idx on deadlines (due_date) where not done;

-- RLS: single-account app. Any authenticated session (there is exactly one
-- user; signups are disabled in the dashboard) gets full access. Anonymous
-- access gets nothing. The .ics route uses the service role key server-side.
alter table events enable row level security;
alter table rsvps enable row level security;
alter table trips enable row level security;
alter table deadlines enable row level security;
alter table settings enable row level security;
alter table sources enable row level security;

create policy "owner all" on events for all to authenticated using (true) with check (true);
create policy "owner all" on rsvps for all to authenticated using (true) with check (true);
create policy "owner all" on trips for all to authenticated using (true) with check (true);
create policy "owner all" on deadlines for all to authenticated using (true) with check (true);
create policy "owner all" on settings for all to authenticated using (true) with check (true);
create policy "owner all" on sources for all to authenticated using (true) with check (true);

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger events_touch before update on events
  for each row execute function touch_updated_at();
create trigger rsvps_touch before update on rsvps
  for each row execute function touch_updated_at();
