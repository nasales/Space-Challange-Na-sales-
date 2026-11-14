-- Monthly series for the featured case studies (Ivan's ~10 places marked in the game).
-- Separate from the grid tables (`series`, `trends`): one row per case and variable, taken
-- from the native pixel of each NASA product that contains the case point.
-- Filled by archivos_preSupabase/etl_cases.py. Run once in the Supabase SQL editor,
-- after supabase_schema.sql (it reuses the `variables` table).

create table if not exists case_series (
  case_id      text    not null,            -- id from pipeline/cases.py, e.g. 'dana_valencia'
  var_id       text    references variables(id) on delete cascade,
  lat          real    not null,            -- case point (not the pixel centre)
  lon          real    not null,
  start_month  date    not null,            -- month of values[1]
  values       real[]  not null,            -- one value per month; null = no data
  climatology  real[]  not null,            -- 12 monthly means (Jan..Dec)
  primary key (case_id, var_id)
);

-- Public read, no writes from the browser (same as the grid tables)
grant select on case_series to anon, authenticated;
alter table case_series enable row level security;
drop policy if exists "public read" on case_series;
create policy "public read" on case_series for select to anon, authenticated using (true);
