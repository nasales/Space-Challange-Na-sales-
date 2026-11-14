# pipeline/ — statistics module (Ivan + Diego)

This file is the agreement between the two owners of `pipeline/`.
Change it only after telling the other person. Code follows this file, not the other way round.

> **v4 (2026-11-14, Perry): who does what, in one line each.**
> - **Diego — generic analysis:** the player can stop anywhere on the map and analyze it. That is
>   the `trends` table: `fill_trends.py` computes every cell × variable from Perry's export; Perry
>   uploads the rows. Diego does **not** build featured cases.
> - **Ivan — featured cases:** about 10 places of interest marked in the game, as
>   `data/cache/case_*.json` (`pipeline/cases.py`, `pipeline/build_cases.py`), at least one
>   non-significant.
> - **Both:** merge `main` into your branch now so you work on this version.
>
> **v3 (2026-11-14, Diego):** after Perry's database files landed in `main`
> (`archivos_preSupabase/`): the `trends` table is filled by us (statistics), with Ivan's
> `analyze_trend` as the official method; new Diego block "fill trends"; `start_month` is a date
> `YYYY-MM-01`; decisions 1 and 3 closed. v2 aligned the split with the chosen dataset.

## Data source (from Perry, database owner)
Reference files: `archivos_preSupabase/encargo_base_de_datos.md` (brief), `supabase_schema.sql` (tables), `etl_espana.py` (download + export).
- Grid of ~1180 land cells of 0.25° over Spain (plus Portugal, Andorra, south of France, north of Morocco/Algeria). `cell_id = floor((lat+90)/0.25) * 1440 + floor((lon+180)/0.25)`. Salamanca = `753817` (centre 40.875, −5.625).
- 6 variables, **monthly means**, `null` for gaps. Stored in Supabase (`variables`, `cells`, `series`, `trends`).
- **The ETL leaves `trends` empty: statistics (Ivan + Diego) fills it.**
- The game reads Supabase live with `get_cell(lat, lon)`. Featured cases must also work offline from `data/cache/case_*.json` (AGENTS.md rule 10), which Ivan builds (`pipeline/build_cases.py`).

| id | Variable | Units | Source (product, version) | From | DOI |
|---|---|---|---|---|---|
| `tair` | Air temperature near the ground | °C | GLDAS-2.1 Noah (`GLDAS_NOAH025_M` 2.1) | 2000 | 10.5067/SXAVCZFAQLNO |
| `wind` | Wind speed near the ground | m/s | GLDAS-2.1 Noah | 2000 | 10.5067/SXAVCZFAQLNO |
| `soilmoist` | Soil moisture 0–10 cm | kg/m² | GLDAS-2.1 Noah | 2000 | 10.5067/SXAVCZFAQLNO |
| `evap` | Evapotranspiration | mm/day | GLDAS-2.1 Noah | 2000 | 10.5067/SXAVCZFAQLNO |
| `precip` | Precipitation | mm/day | GPM IMERG Final (`GPM_3IMERGM` 07) | 1998 | 10.5067/GPM/IMERG/3B-MONTH/07 |
| `t2m_long` | 2 m temperature (long series) | °C | MERRA-2 (`M2TMNXSLV` 5.12.4) | 1980 | 10.5067/AP1B0BA5PD2K |

JSON export (`etl_espana.py --export-dir export`):
- `export/variables.json`: `{var_id: {name_en, unit, source, definition_en}}`
- `export/cells/<cell_id>.json`: `{cell_id, lat, lon, region, vars: {var_id: {start_month, values, climatology, trend}}}`
- `start_month` and `period_start`/`period_end` are dates `"YYYY-MM-01"`; `values` rounded to 4 decimals, `null` = gap.
- `trends` row: `cell_id`, `var_id`, `period_start`, `period_end`, `n_months`, `mean_value`, `slope_per_decade`, `slope_ci_low`, `slope_ci_high` (CI also per decade), `mk_tau`, `p_value`, `significant`, `direction`.

## Who owns what
| File | Owner |
|---|---|
| `pipeline/__init__.py`, `pipeline/trend.py`, `pipeline/explain.py`, `pipeline/tests/test_trend.py`, `pipeline/tests/test_explain.py`, `pipeline/compare_db.py`, `pipeline/tests/test_compare_db.py`, `tests/stats/test_diego_cross.py`, `pipeline/cases.py`, `pipeline/nasa_power.py`, `pipeline/build_cases.py`, `pipeline/tests/test_nasa_power.py`, `pipeline/tests/test_build_cases.py`, `data/raw/power/`, `data/cache/case_*.json` (featured case studies), `data/cases_index.json` | Ivan |
| `pipeline/series.py`, `pipeline/sources/*.py`, `pipeline/build_case.py`, `pipeline/fill_trends.py`, `pipeline/check_trends.py`, `pipeline/dry_run.py`, `pipeline/tests/test_series.py`, `pipeline/tests/test_build_case.py`, `pipeline/tests/test_sources.py`, `pipeline/tests/test_fill_trends.py`, `pipeline/tests/test_check_trends.py`, `pipeline/tests/test_dry_run.py`, `data/raw/` (except `data/raw/power/`) | Diego |
| `pipeline/requirements.txt`, `pipeline/tests/__init__.py`, `AI_USAGE.md`, `REFERENCES.md` | Shared: append lines at the end only |

An agent working for one owner must not edit the other owner's files. Never edit `docs/contract.md`; edit `tests/stats/` only when the human asks and reviews (AGENTS.md rule 3).

## Interface 1 — `Series` (Diego, `pipeline/series.py`)
```python
@dataclass
class Series:
    place: str
    lat: float
    lon: float
    variable: str               # dataset id, e.g. "tair"
    units: str                  # e.g. "°C"
    dataset: str                # e.g. "GLDAS-2.1 Noah"
    dates: list[str]            # "YYYY-MM", sorted, monthly, no duplicates
    values: list[float | None]  # same length as dates; None = gap
```
Rules: always monthly, always sorted, gaps are `None` (never NaN or fill codes -999 / -9999 / -99999).
Constructor: `from_start_month(start_month, values, *, place, lat, lon, variable, units, dataset)`; `start_month` is `"YYYY-MM"` or `"YYYY-MM-01"`.
Helpers: `parse_month`, `format_month`, `next_month`, `normalize_month` (`"2000-01-01"` -> `"2000-01"`).
Later, only if needed: `load_csv(path, ...)` (columns `date,value`). Rule agreed for daily input: a month with data on fewer than half of its days becomes `None`.

## Interface 2 — `analyze_trend` (Ivan, `pipeline/trend.py`) — the official trend
```python
def analyze_trend(dates: list[str], values: list[float | None], alpha: float = 0.05) -> dict
```
Its results fill the Supabase `trends` table, so the game shows exactly this.
**Reference implementation:** `trend_stats()` in `archivos_preSupabase/etl_espana.py` (Perry's optional `--with-trends`, not used in production). Same method:
1. Anomalies: value minus the climatology of its calendar month.
2. Slope: Sen slope on real time in years, returned in **units/year** (the database stores per decade = per year × 10).
3. Significance: Mann-Kendall with pre-whitening, Yue and Wang 2002: `pymannkendall.pre_whitening_modification_test` on the anomalies.
4. 95 % CI of the slope: Gilbert 1987, variance inflated by (1+ρ)/(1−ρ), ρ = lag-1 autocorrelation of the residuals clipped to [0, 0.95].

Returns at least `slope`, `p_value`, `significant`, `test` (contract names), plus `slope_ci_low`, `slope_ci_high`, `mk_tau`, `n_points` (valid months), `mean_value` (mean of the raw values), `start`, `end`, `total_change`, `direction`.
`direction` follows the database rule: `"increasing"` / `"decreasing"` only when significant, otherwise `"no trend"`.
Raises `ValueError` for **fewer than 120 non-null months**, mismatched lengths or unsorted dates.
Until the real one is merged, Diego uses a stub with the same signature returning
`{"slope": 0.0, "p_value": 1.0, "significant": False, "test": "stub"}`.

## Interface 3 — output (Diego, `pipeline/build_case.py`)
```python
def build_case(series: Series, trend: dict) -> dict   # required fields of docs/contract.md
def write_case(case: dict, path: str) -> None         # writes data/cache/<id>.json
def trend_from_db(row: dict) -> dict                  # Supabase `trends` row -> same keys as analyze_trend (slope per year)
def get_analyze_trend()                               # Ivan's analyze_trend if pipeline/trend.py exists, else the stub
def case_id(place: str, variable: str) -> str         # "Cádiz", "precip" -> "cadiz_precip" (file name)
```
`write_case` refuses fields outside the contract and cases computed with the stub (`test == "stub"`), so stub results never reach `data/cache/`.
Database trends are labelled `test = "mann-kendall-prewhitening-yue-wang-2002"` (same as `TEST_NAME` in `trend.py`).
Only the contract's required fields go into the JSON. Extra fields need approval from the data owner and Yeipi (contract change).

## Interface 4 — fill the `trends` table (Diego, `pipeline/fill_trends.py`)
```python
def trend_to_db_row(trend: dict, series: Series, cell_id: int, var_id: str) -> dict  # analyze_trend dict -> `trends` row (slope ×10)
def fill_trends(export_dir, out_path, *, sql_path=None, update_export=False, var_ids=None) -> dict
```
Reads the JSON export, runs Ivan's `analyze_trend` on every series with ≥ 120 valid months, writes the rows and reports how many were skipped and why. A `ValueError` from `analyze_trend` skips that series; any other error stops the run. Refuses to run with the stub.
```bash
py -m pipeline.fill_trends --export-dir export --out trends_rows.json --sql trends_upsert.sql --update-export
```
- `trends_rows.json`: same shape as the ETL's `trends.json`.
- `trends_upsert.sql`: idempotent upsert (`on conflict (cell_id, var_id) do update`) to paste in the Supabase SQL editor.
- `--update-export`: writes each trend into `export/cells/<id>.json` and `export/trends.json` (plan B and featured cases).

## Interface 5 — checks before upload (Diego, `pipeline/check_trends.py`, `pipeline/dry_run.py`)
```bash
py -m pipeline.check_trends --export-dir export --rows trends_rows.json --report trends_check.md
py -m pipeline.dry_run            # synthetic export with known truth, full size (~5 min)
```
- `check_trends`: coverage (every series has a row or is < 120 months), consistency errors (significant vs p, CI contains slope, NaN, direction rule, duplicates), plausible units per variable (e.g. °C not K), summary per variable and a cross-check of GLDAS `tair` vs MERRA-2 `t2m_long` recomputed over the same period. **Exit code 1 on any error: do not upload.**
- `dry_run`: runs `fill_trends` on 1184 synthetic cells × 6 variables (real lengths, seasonal cycle, AR(1) noise, gaps, 50 % no trend) and reports false-positive rate, power, slope bias and CI coverage.

Dry run 2026-11-14 (seed 2026, 7104 series): 7035 rows, 69 skipped (all < 120 months), 6 min, 57 MB peak, SQL 1.4 MB; `check_trends` on it: 0 errors, 28 s.

| variable | false positives | power (moderate) | power (strong) | slope bias | 95 % CI coverage |
|---|---|---|---|---|---|
| tair | 5.2 % | 75 % | 100 % | −0.2 % | 94.8 % |
| wind | 4.7 % | 91 % | 100 % | −0.6 % | 95.6 % |
| soilmoist | 4.7 % | 38 % | 100 % | +2.9 % | 95.8 % |
| evap | 5.6 % | 74 % | 100 % | +1.2 % | 94.7 % |
| precip | 6.8 % | 99 % | 100 % | −0.8 % | 93.9 % |
| t2m_long | 4.9 % | 100 % | 100 % | −0.6 % | 95.4 % |

Moderate = 0.3 anomaly sd per decade, strong = 1 sd per decade. Low power for `soilmoist` comes from its strong autocorrelation (AR(1) φ = 0.7), not from a bug.

## Work blocks (in order; each person works on their own branch and merges to `main` per block after QA passes)
Before starting, ask the human which person they are (Ivan or Diego) and which block is next. Do only that block, only in that owner's files.

| # | Owner | Branch | Block | Done when |
|---|---|---|---|---|
| 0 | Ivan + Diego | `ivan_dev` / `diego_dev` | This README and `pipeline/__init__.py` | Both agree and have it on their branch |
| 1 | Ivan | `ivan_dev` | `analyze_trend` in `trend.py` with the method above | `pytest pipeline/tests` passes with synthetic tests (known trend, negative trend, seasonal no-trend, white-noise false-positive rate, autocorrelated no-trend, gaps, < 120 months, bad input) and matches `trend_stats()` on the same synthetic series |
| 1 | Diego | `diego_dev` | ✅ `Series`, `Series.validate()` and `from_start_month()` | Tests pass for gaps, fill codes, NaN, malformed start month, database dates, unsorted/duplicated/missing dates, bad metadata |
| 2 | Ivan | `ivan_dev` | Robustness: warning when the series has many gaps. ~~Optional annual-mean trend~~ dropped: pre-whitening on ~20 annual means removes most of the trend | New tests pass, old ones still pass |
| 2 | Diego | `diego_dev` | ✅ `build_case` + `write_case` + `trend_from_db`, using the stub `analyze_trend` until block 1 of Ivan is merged | Output passes the contract validator |
| 3 | Ivan + Diego (humans, cross) | — | ✅ `tests/stats/test_diego_cross.py` (Ivan on Diego's code) and `tests/stats/test_ivan_cross.py` (Diego on Ivan's `analyze_trend`: known trend in units/year, flip/shift symmetry, red-noise false positives). Each human writes 2-3 tests of the other's code in `tests/stats/` (an agent may write them only when its human asks and reviews them, AGENTS.md rule 3) | They pass, or a bug line goes to the owner |
| 4 | Diego | `diego_dev` | ✅ (fake export; recheck with the real one) Adapter `pipeline/sources/supabase_export.py` (`cell_id_for`, `find_cell`, `load_series`, `load_trend`, `iter_series`): reads `export/cells/<cell_id>.json` + `variables.json` into `Series` + trend dict | Returns a valid `Series` for cell `753817` (Salamanca) |
| 4 | Ivan | `ivan_dev` | `explain(trend, series) -> str` in `explain.py`: plain-English facts for the AI checker | Correct text for one significant and one non-significant case |
| 5 | Diego | `diego_dev` | ✅ (needs Ivan's `trend.py` to run for real) `fill_trends.py` (Interface 4): trends for all cells × variables, handed to Perry for upload | Rows file passes a schema check; skipped series listed with a reason |
| 6 | Diego | `diego_dev` | Generic analysis: run `fill_trends.py` on Perry's real export (all cells × 6 variables), then `check_trends.py` on the rows, and report to Perry that it runs clean; Perry uploads the rows to `trends`. ✅ Prepared: `dry_run.py` + `check_trends.py` (Interface 5). No featured cases (they are Ivan's) | `check_trends` exits 0 on the real rows; skipped series listed with a reason |
| 6 | Ivan | `ivan_dev` | Featured cases: about 10 places of interest marked in the game, in `data/cache/case_*.json`, at least one non-significant. Then (a) Spot-check `analyze_trend` against `trend_stats()` on real cells (slope, p-value, significant). (b) Compare one featured case with Giovanni (direction and rough size) | Cases pass `./scripts/check.sh`; differences noted in the SYNC CHECK report; any mismatch in `significant` goes as a bug line |

## Integration
- Each person merges their own branch into `main`, always after the QA checks pass (`./scripts/check.sh`, QA report in `docs/agents/qa.md`).
- ✅ After Ivan's block 1 is merged: the real `analyze_trend` replaces the stub automatically (`get_analyze_trend()`); checked end to end.
- If Perry runs the ETL with `--with-trends` (for `compare_db.py`), those trends are only for comparison: `fill_trends` then upserts the official `analyze_trend` rows over them.
- Featured cases (Ivan): NASA POWER point data -> `pipeline/build_cases.py` -> `data/cache/case_*.json`, handed to Yeipi.
- After the real export: Diego runs `fill_trends` + `check_trends`; Perry uploads the rows only if `check_trends` exits 0; `get_cell` then returns real trends to the game.
- Before Sunday 13:00 (freeze): `trends` filled (Diego + Perry), all featured cases in `data/cache/` (Ivan), `check.sh` green, `AI_USAGE.md` and `REFERENCES.md` complete.

## Decisions
Closed:
- **Which trend does the game show?** Ivan's `analyze_trend`, written to `trends` by Diego's `fill_trends` (Perry's brief: statistics fills `trends`).
- **Mann-Kendall variant:** `pymannkendall.pre_whitening_modification_test`, as in `trend_stats()`.

- **How the trend rows reach Supabase** (Perry, 2026-11-14): Perry runs `py -m pipeline.fill_trends` himself on the real export and uploads the result (SQL upsert or rows with his DB connection). Diego never needs the database password. Diego's job: make sure `fill_trends.py` runs clean on the real export as soon as Perry shares it.
- **Multiple comparisons** (Diego, 2026-11-14): each cell is judged alone at p < 0.05, as the contract says. With ~7000 tests about 5 % of no-trend cells come out significant by chance; this is stated as a known limitation in the pitch, no FDR correction.

Open:
1. **Duplicated dates in a CSV:** error or average? Diego will decide; for now they raise `ValueError`.
