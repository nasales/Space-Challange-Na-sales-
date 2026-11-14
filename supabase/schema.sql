-- Table for featured cases. Columns = docs/contract.md fields + id.
-- Run in the Supabase SQL editor. Changing the contract fields needs Person 3 + Yeipi approval.
create table if not exists public.cases (
  id          text primary key,              -- e.g. "sahara_surface_temperature"
  place       text not null,
  lat         double precision not null check (lat between -90 and 90),
  lon         double precision not null check (lon between -180 and 180),
  variable    text not null,
  units       text not null,
  dataset     text not null,
  dates       text[] not null,
  "values"    double precision[] not null,   -- nulls allowed inside the array for gaps
  slope       double precision not null,
  p_value     double precision not null check (p_value between 0 and 1),
  significant boolean not null,
  test        text not null,
  created_at  timestamptz not null default now()
);

-- Only the backend (service role key) reads and writes. No public access from the browser.
alter table public.cases enable row level security;
