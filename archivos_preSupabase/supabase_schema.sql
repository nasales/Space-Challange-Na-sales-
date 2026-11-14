-- Earth System Trend Detective — esquema para Supabase (Postgres)
-- Pegar en: Supabase → SQL Editor → New query → Run
-- Rejilla regular de 0,25° (la de GLDAS). cell_id = fila * 1440 + columna,
--   fila    = floor((lat + 90) / 0.25)
--   columna = floor((lon + 180) / 0.25)
-- Solo se guardan celdas de tierra (el mapa del juego no tiene mar). No hace falta PostGIS.

create table if not exists variables (
  id          text primary key,           -- 'precip', 'tair', ...
  name_en     text not null,              -- se muestra en el juego (todo en inglés)
  unit        text not null,
  source      text not null,              -- dataset NASA de origen, para citar
  definition_en text not null             -- definición sencilla (consideración opcional del reto)
);

create table if not exists cells (
  cell_id  integer primary key,
  lat      real not null,                 -- centro de la celda
  lon      real not null,
  region   text not null                  -- 'peninsula_baleares' | 'canarias'
);

-- Serie mensual completa: una fila por celda y variable.
create table if not exists series (
  cell_id      integer references cells(cell_id) on delete cascade,
  var_id       text    references variables(id)  on delete cascade,
  start_month  date    not null,            -- primer mes de values[1]
  values       real[]  not null,            -- un valor por mes; null = sin dato
  climatology  real[]  not null,            -- 12 medias mensuales (ene..dic)
  primary key (cell_id, var_id)
);

-- Resultado estadístico. La rellena el equipo de estadística, no el script de carga.
-- Mientras esté vacía, get_cell devuelve estas columnas a null.
create table if not exists trends (
  cell_id        integer references cells(cell_id) on delete cascade,
  var_id         text    references variables(id)  on delete cascade,
  period_start   date    not null,
  period_end     date    not null,
  n_months       integer not null,
  mean_value     real,
  slope_per_decade real,                   -- tasa de cambio por década (método: lo decide estadística)
  slope_ci_low   real,                     -- IC 95 % de la pendiente
  slope_ci_high  real,
  mk_tau         real,
  p_value        real,                     -- p-valor del test de tendencia
  significant    boolean,                  -- p < 0.05
  direction      text,                     -- 'increasing' | 'decreasing' | 'no trend'
  primary key (cell_id, var_id)
);

create index if not exists trends_var_idx on trends (var_id);

-- Lectura pública, escritura prohibida desde el navegador
grant select on variables, cells, series, trends to anon, authenticated;
alter table variables enable row level security;
alter table cells     enable row level security;
alter table series    enable row level security;
alter table trends    enable row level security;

create policy "public read" on variables for select to anon, authenticated using (true);
create policy "public read" on cells     for select to anon, authenticated using (true);
create policy "public read" on series    for select to anon, authenticated using (true);
create policy "public read" on trends    for select to anon, authenticated using (true);

-- Lo que llama el juego cuando el coche para: todo lo de esa celda en una petición.
-- Solo hay celdas de tierra. Si el punto cae en una celda que la máscara de GLDAS
-- considera mar (costa, islas pequeñas), devuelve la celda de tierra más cercana
-- (como mucho a ~0,5°) e indica la distancia en distance_km.
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
