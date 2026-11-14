-- Earth System Trend Detective — Supabase (Postgres) schema
-- Paste in: Supabase → SQL Editor → New query → Run
-- Regular 0.25° grid (the GLDAS one). cell_id = row * 1440 + column,
--   row    = floor((lat + 90) / 0.25)
--   column = floor((lon + 180) / 0.25)
-- Only land cells are stored (the game map has no sea). PostGIS is not needed.

create table if not exists variables (
  id          text primary key,           -- 'precip', 'tair', ...
  name_en     text not null,              -- shown in the game (everything in English)
  unit        text not null,
  source      text not null,              -- source NASA dataset, for citation
  definition_en text not null             -- simple definition (optional challenge consideration)
);

create table if not exists cells (
  cell_id  integer primary key,
  lat      real not null,                 -- cell centre
  lon      real not null,
  region   text not null                  -- 'peninsula_baleares' | 'canarias'
);

-- Full monthly series: one row per cell and variable.
create table if not exists series (
  cell_id      integer references cells(cell_id) on delete cascade,
  var_id       text    references variables(id)  on delete cascade,
  start_month  date    not null,            -- month of values[1]
  values       real[]  not null,            -- one value per month; null = no data
  climatology  real[]  not null,            -- 12 monthly means (Jan..Dec)
  primary key (cell_id, var_id)
);

-- Statistical result. Filled by the statistics team (pipeline/fill_trends.py), not by the ETL.
-- While it is empty, get_cell returns these columns as null.
create table if not exists trends (
  cell_id        integer references cells(cell_id) on delete cascade,
  var_id         text    references variables(id)  on delete cascade,
  period_start   date    not null,
  period_end     date    not null,
  n_months       integer not null,
  mean_value     real,
  slope_per_decade real,                   -- rate of change per decade (Sen slope on anomalies)
  slope_ci_low   real,                     -- 95 % CI of the slope (per decade)
  slope_ci_high  real,
  mk_tau         real,
  p_value        real,                     -- p-value of the trend test
  significant    boolean,                  -- p < 0.05
  direction      text,                     -- 'increasing' | 'decreasing' | 'no trend'
  primary key (cell_id, var_id)
);

create index if not exists trends_var_idx on trends (var_id);

-- Public read, no writes from the browser
grant select on variables, cells, series, trends to anon, authenticated;
alter table variables enable row level security;
alter table cells     enable row level security;
alter table series    enable row level security;
alter table trends    enable row level security;

create policy "public read" on variables for select to anon, authenticated using (true);
create policy "public read" on cells     for select to anon, authenticated using (true);
create policy "public read" on series    for select to anon, authenticated using (true);
create policy "public read" on trends    for select to anon, authenticated using (true);

-- What the game calls when the car stops: everything for that cell in one request.
-- Only land cells exist. If the point falls in a cell that the GLDAS mask considers
-- sea (coast, small islands), it returns the nearest land cell (at most ~0.5° away)
-- and gives the distance in distance_km.
drop function if exists get_cell(double precision, double precision);
create or replace function get_cell(p_lat double precision, p_lon double precision)
returns table (
  cell_id integer, lat real, lon real, distance_km real, var_id text, name_en text,
  unit text, source text, definition_en text, start_month date, "values" real[],
  climatology real[], period_start date, period_end date, slope_per_decade real,
  slope_ci_low real, slope_ci_high real, p_value real, significant boolean, direction text
)
language sql stable
as $$
  with near as (
    select c.cell_id, c.lat, c.lon,
           (111.2 * sqrt(power(c.lat - p_lat, 2)
                       + power((c.lon - p_lon) * cos(radians(p_lat)), 2)))::real as distance_km
    from cells c
    where c.lat between p_lat - 0.5 and p_lat + 0.5
      and c.lon between p_lon - 0.6 and p_lon + 0.6
    order by distance_km
    limit 1
  )
  select n.cell_id, n.lat, n.lon, n.distance_km, v.id, v.name_en, v.unit, v.source,
         v.definition_en, s.start_month, s.values, s.climatology,
         t.period_start, t.period_end, t.slope_per_decade, t.slope_ci_low,
         t.slope_ci_high, t.p_value, t.significant, t.direction
  from near n
  join series s    on s.cell_id = n.cell_id
  join variables v on v.id = s.var_id
  left join trends t on t.cell_id = s.cell_id and t.var_id = s.var_id;
$$;

grant execute on function get_cell(double precision, double precision) to anon, authenticated;
