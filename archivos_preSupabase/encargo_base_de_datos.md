# Brief: loading the NASA data into Supabase

> **For the agent reading this:** you are helping the database owner (Perry) load NASA data into Supabase. This document and the two files next to it (`supabase_schema.sql` and `etl_espana.py`) are the whole context. The decisions below were taken by the team: do not redesign them without asking, because the frontend and statistics depend on them. If something fails, fix it in these files.

## 1. Situation

- **Event:** NASA Space Apps Challenge 2026, Salamanca site, challenge *"Be An Earth System Trend Detective!"*.
- **Deadlines:** pitch on Sunday 15/11 at 17:30; submission closes on Sunday 15/11 at 23:59 (Salamanca time). Feature freeze on Sunday at 13:00.
- **Project:** a web detective game. The player drives a police car over a 3D map of Spain and stops at a place, picks a variable and sees charts of its evolution, without the conclusion. The player writes a conclusion and an AI checks it.
- **Stack:** Supabase (database), Vite (frontend), Vercel (deployment).
- **Split:**
  - **Perry (database owner):** load the series into Supabase and run the scripts that write to it.
  - **Diego (statistics):** `pipeline/fill_trends.py`, which computes the trends that fill the `trends` table, and the featured cases in `data/cache/`.
  - **Ivan (statistics):** `pipeline/trend.py` (`analyze_trend`, the official method) and `pipeline/compare_db.py`.
  - **Yeipi:** the interface.
  - **A teammate:** Vite and Vercel.

## 2. Scope

**Perry does:**
1. Create the schema in Supabase. ✅ Done (2026-11-14).
2. Download the monthly series for Spain from NASA and load them (`series`, `cells`, `variables`). ✅ Done (2026-11-14): 6 variables, 1184 cells, 7090 series.
3. Check that the load is complete and correct (section 6). ✅ Done (2026-11-14).
4. Give the frontend what it needs to read the data (section 5, step 6).
5. Run Diego's `fill_trends.py` on the JSON export and upload its rows to `trends`. Only Perry holds the database password, so Diego never needs it.

**Not in this task:**
- Trend method and statistical validation: that is statistics (Ivan + Diego), see `pipeline/README.md`.
- The ETL does **not** fill `trends` in production. The official rows come from `fill_trends.py` (Ivan's `analyze_trend`).
- `--with-trends` is used only to get an independent reference copy of the trends for Ivan's `compare_db.py` check. Those rows are overwritten by `fill_trends.py`.

## 3. Decisions already taken

| Decision | Value |
|---|---|
| Area | Peninsula and Balearic Islands (lon −9.5 to 4.5; lat 35.75 to 44) and Canary Islands (lon −18.25 to −13.25; lat 27.5 to 29.5) |
| Sea | **No sea** on the map: only land cells, from the GLDAS mask |
| Grid | 0.25° (about 28 km), native GLDAS grid. Measured: 1174 cells in the Peninsula and Balearics + 10 in the Canaries = 1184 |
| Time step | Monthly |
| Source | NASA only, from GES DISC, with the `earthaccess` library (needs an Earthdata account) |

**The 6 variables:**

| id | Variable | NASA product (short_name, version) | Original variable | Final unit | From | To 0.25° |
|---|---|---|---|---|---|---|
| `tair` | Air temperature | `GLDAS_NOAH025_M` 2.1 | `Tair_f_inst` | °C | 2000 | Native |
| `wind` | Wind speed | `GLDAS_NOAH025_M` 2.1 | `Wind_f_inst` | m/s | 2000 | Native |
| `soilmoist` | Soil moisture 0–10 cm | `GLDAS_NOAH025_M` 2.1 | `SoilMoi0_10cm_inst` | kg/m² | 2000 | Native |
| `evap` | Evapotranspiration | `GLDAS_NOAH025_M` 2.1 | `Evap_tavg` | mm/day | 2000 | Native |
| `precip` | Precipitation | `GPM_3IMERGM` 07 | `precipitation` (group `Grid`) | mm/day | 1998 | Linear interpolation from 0.1° |
| `t2m_long` | 2 m temperature (long series) | `M2TMNXSLV` 5.12.4 | `T2M` | °C | 1980 | Nearest point from 0.5° × 0.625° |

**DOIs to cite:**
- GLDAS: 10.5067/SXAVCZFAQLNO
- IMERG: 10.5067/GPM/IMERG/3B-MONTH/07
- MERRA-2: 10.5067/AP1B0BA5PD2K

## 4. The database (`supabase_schema.sql`)

- `variables`: id, `name_en`, unit, source and `definition_en`. In English because the player sees them.
- `cells`: `cell_id`, lat, lon and region. Land cells only.
  - `cell_id = floor((lat+90)/0.25) * 1440 + floor((lon+180)/0.25)`. Salamanca = `753817`.
- `series`: one row per cell and variable.
  - `start_month`: date `YYYY-MM-01` of `values[1]`.
  - `values`: `real[]`, one value per month; `null` = no data.
  - `climatology`: `real[12]`, the January to December means.
- `trends`: filled by `pipeline/fill_trends.py` (statistics), run by Perry.
- **Permissions:** RLS on. Anyone can read; nobody can write from the browser.
- **Function `get_cell(p_lat, p_lon)`:** returns the variables of the nearest land cell (within ~0.5°) and the distance in `distance_km`. A point in open sea returns nothing. While `trends` is empty, its columns come back as `null`.

## 5. Steps

1. **NASA Earthdata account:** https://urs.earthdata.nasa.gov. In the profile, *Applications → Authorized Apps*, authorize **"NASA GESDISC DATA ARCHIVE"**. Then save the credentials once:
   ```bash
   python -c "import earthaccess; earthaccess.login(strategy='interactive', persist=True)"
   ```
2. **Supabase project** (free plan, EU region). In the *SQL Editor*, paste `supabase_schema.sql` and run it.
3. **Install the dependencies** (Python 3.10 or later; tested on 3.14):
   ```bash
   pip install earthaccess xarray h5netcdf h5py netCDF4 scipy numpy pymannkendall "psycopg[binary]"
   ```
   `h5py` is required: recent `h5netcdf` versions no longer install it.
4. **Small test:**
   ```bash
   python etl_espana.py --only tair --export-dir export
   ```
   It first reads one GLDAS month for the land mask and prints "Land in … cells", then "[tair] N cells with a series".
5. **Full load** (~1200 monthly files; about 1 h with 4 parallel workers). It can be run per product (`--only tair wind soilmoist evap`, then `--only precip t2m_long`); each run upserts its own variables. Each monthly subset is cached in `etl_cache/` (or `ETL_CACHE_DIR`), so a crashed or stopped run resumes where it stopped; `ETL_WORKERS` sets the number of parallel readers (default 4):
   ```bash
   export SUPABASE_DB_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-eu-....pooler.supabase.com:5432/postgres"
   python etl_espana.py --upload --export-dir export
   ```
   Get the string from the project's **Connect** button → *Connection String* → Type `URI`, Method **Session pooler** (the direct one is usually IPv6 only). Replace `[YOUR-PASSWORD]` **including the brackets**. Keep it in `.env.local` at the repo root (ignored by git); never commit it.
6. **Hand over to the frontend** (Vercel → *Settings → Environment Variables*):
   - `VITE_SUPABASE_URL` = the Project URL.
   - `VITE_SUPABASE_ANON_KEY` = the public key (anon or publishable).

   **Never** the database password or the `service_role` key. Frontend usage:
   ```js
   const { data } = await supabase.rpc('get_cell', { p_lat: 40.96, p_lon: -5.66 })
   ```
7. **Trends:** give Diego the `export/` folder, or run his script yourself:
   ```bash
   py -m pipeline.fill_trends --export-dir export --out trends_rows.json --sql trends_upsert.sql --update-export
   ```
   Then paste `trends_upsert.sql` into the Supabase SQL editor (or upload the rows with the DB connection). Keep a copy of the export made with `--with-trends` if Ivan wants to run `compare_db.py`.
8. **Plan B:** the `export/` folder (one JSON per cell plus `variables.json`) can be copied into `public/data/` of the Vite project. Featured cases must work offline from `data/cache/` (AGENTS.md rule 10).

## 6. Load checks (the load only, not the statistics)

- [ ] `select var_id, count(*) from series group by var_id;` returns 6 variables, all with the same number of cells (1184).
- [ ] `select var_id, start_month, array_length(values,1) from series where cell_id = 753817;` (Salamanca):
  - `tair`, `wind`, `soilmoist` and `evap` start in 2000;
  - `precip` starts in 1998;
  - `t2m_long` starts in 1980.
- [ ] `select * from get_cell(40.96, -5.66);` returns 6 rows, with the cell centred at 40.875 / −5.625.
- [ ] `get_cell(36.53, -6.29)` (Cádiz, on the coast) returns a nearby cell with a small `distance_km`; a point in open sea returns nothing.
- [ ] Units make sense: in Salamanca, a mean temperature of about 12 °C (not about 285, which would be Kelvin) and precipitation of 1–2 mm/day.
- [ ] In *Settings → Usage*, the database uses tens of MB, far from the 500 MB limit of the free plan.

## 7. Test results and known risks

Already tested against the real NASA servers (2026-11-14):
- GLDAS `tair`: 1184 cells; Salamanca 2000-01 → 2026-07, 319 months, no gaps, mean 12.2 °C.
- IMERG `precip` (3 months): 1184 cells; Salamanca 1.0–1.8 mm/day. Variable names and the (time, lon, lat) order work as written.
- MERRA-2 `t2m_long` (3 months): 1184 cells; Salamanca 3.6–6.8 °C in winter 1980.
- Memory: each remote file is closed after reading (it used to grow ~14 MB per file).
- NASA returned a transient `502 Bad Gateway` once; the ETL now retries each file up to 6 times with backoff.

Full load results (2026-11-14, in Supabase, 24 MB):
- `tair`, `wind`, `precip`, `t2m_long`: 1184 cells; `soilmoist`, `evap`: 1177 cells. The 7 cells without soil variables are coastal cells where GLDAS has air data but no soil data, two of them in Lanzarote and Fuerteventura: `get_cell` returns 4 variables there, so the interface must handle missing variables.
- Periods: GLDAS 2000-01 → 2026-07 (319 months), IMERG 1998-01 → 2025-09 (333), MERRA-2 1980-01 → 2026-09 (561). No gaps in Salamanca.
- Salamanca means: `tair` 12.2 °C, `t2m_long` 12.4 °C, `precip` 1.78 mm/day, `wind` 3.6 m/s, `soilmoist` 21.6 kg/m², `evap` 1.43 mm/day.
- `get_cell`: Salamanca 6 rows (cell at 9.9 km); Cádiz returns a land cell at 18 km; open sea returns nothing.
- `variables.json` is now written as UTF-8 (before, Windows wrote it in cp1252).

Known risks:
- **Canaries:** only 10 land cells. La Gomera and El Hierro may not have their own cell; then `get_cell` returns the one of the neighbouring island.
- **MERRA-2 on the coast:** it is coarse, and its nearest point to a coastal cell may fall in the sea.
- **Free Supabase pauses** after 7 days without activity, and the judges look at the project in December and January. That is why the JSON plan B exists.

## 8. Challenge rules that affect this task

- Everything the player sees is in English. `name_en` and `definition_en` already are.
- NASA data must be cited (DOIs above) in `REFERENCES.md`.
- The script was written with AI help: declared in `AI_USAGE.md` and in the "Use of AI" field of the submission.
- No NASA logos in the interface.
