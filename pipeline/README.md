# pipeline/ — statistics module (Ivan + Diego)

This file is the agreement between the two owners of `pipeline/`.
Change it only after telling the other person. Code follows this file, not the other way round.

> **v2 (2026-11-14, Diego):** adjusted to the dataset chosen by the database owner
> (`docs/Estadística qué datos vais a ver.md`). Changes: data source section, trend method aligned
> with the database, minimum 120 months, Diego's adapter now reads the Supabase JSON export,
> all work on branches `diego_dev` / `ivan_dev`, open decisions listed at the end.

## Data source (from the database owner)
- Grid of ~1180 land cells of 0.25° over Spain (plus Portugal, Andorra, south of France, north of Morocco/Algeria).
- 6 variables, **monthly means**, `null` for gaps. Stored in Supabase (tables `series`, `trends`) and **exported to JSON**.
- The game never calls Supabase live: Diego turns the JSON export into `data/cache/*.json` (AGENTS.md rule 10).

| id | Variable | Units | Source | From |
|---|---|---|---|---|
| `tair` | Air temperature near the ground | °C | GLDAS-2.1 Noah | 2000 |
| `wind` | Wind speed near the ground | m/s | GLDAS-2.1 Noah | 2000 |
| `soilmoist` | Soil moisture 0–10 cm | kg/m² | GLDAS-2.1 Noah | 2000 |
| `evap` | Evapotranspiration | mm/day | GLDAS-2.1 Noah | 2000 |
| `precip` | Precipitation | mm/day | GPM IMERG Final V07 | 1998 |
| `t2m_long` | 2 m temperature (long series) | °C | MERRA-2 | 1980 |

Export shape per cell and variable: `series` row = `start_month`, `values` (one per month, in order), `climatology` (12 monthly means);
`trends` row = `period_start`, `period_end`, `n_months`, `mean_value`, `slope_per_decade`, `slope_ci_low`, `slope_ci_high`, `mk_tau`, `p_value`, `significant`, `direction`.

## Who owns what
| File | Owner |
|---|---|
| `pipeline/__init__.py`, `pipeline/trend.py`, `pipeline/explain.py`, `pipeline/tests/test_trend.py`, `pipeline/tests/test_explain.py` | Ivan |
| `pipeline/series.py`, `pipeline/sources/*.py`, `pipeline/build_case.py`, `pipeline/tests/test_series.py`, `pipeline/tests/test_build_case.py`, `pipeline/tests/test_sources.py`, `data/raw/`, `data/cache/*.json` | Diego |
| `pipeline/requirements.txt`, `pipeline/tests/__init__.py`, `AI_USAGE.md`, `REFERENCES.md` | Shared: append lines at the end only |

An agent working for one owner must not edit the other owner's files. Never edit `docs/contract.md` or `tests/stats/`.

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
Constructor: `from_start_month(start_month, values, *, place, lat, lon, variable, units, dataset)` (Supabase export shape).
Later, only if needed: `load_csv(path, ...)` (columns `date,value`). Rule agreed for daily input: a month with data on fewer than half of its days becomes `None`.

## Interface 2 — `analyze_trend` (Ivan, `pipeline/trend.py`)
```python
def analyze_trend(dates: list[str], values: list[float | None], alpha: float = 0.05) -> dict
```
**Same method as the database**, so both give the same answer for the same series:
1. Anomalies: value minus the climatology of its calendar month.
2. Slope: Sen slope on real time (`scipy.stats.theilslopes`), returned in **units/year** (database stores per decade: per year = per decade / 10).
3. Significance: Mann-Kendall with pre-whitening, Yue and Wang 2002 (`pymannkendall.pre_whitening_modification_test`; not `yue_wang_modification_test`, which is a different 2004 variance correction). Confirm it matches the database script.
4. 95 % CI of the slope: Gilbert 1987, variance inflated by (1+ρ)/(1−ρ), ρ = lag-1 autocorrelation of the residuals.

Returns at least `slope`, `p_value`, `significant`, `test` (contract names), plus `slope_ci_low`, `slope_ci_high`, `mk_tau`, `n_points`, `start`, `end`, `total_change`, `direction` (`increasing` / `decreasing` / `no trend`).
Raises `ValueError` for **fewer than 120 non-null months**, mismatched lengths or unsorted dates.
Until the real one is merged, Diego uses a stub with the same signature returning
`{"slope": 0.0, "p_value": 1.0, "significant": False, "test": "stub"}`.

## Interface 3 — output (Diego, `pipeline/build_case.py`)
```python
def build_case(series: Series, trend: dict) -> dict   # required fields of docs/contract.md
def write_case(case: dict, path: str) -> None         # writes data/cache/<id>.json
def trend_from_db(row: dict) -> dict                  # Supabase `trends` row -> same keys as analyze_trend (slope per year)
```
Only the contract's required fields go into the JSON. Extra fields need approval from the data owner and Yeipi (contract change).

## Work blocks (in order; each person works on their own branch and merges to `main` per block after QA passes)
Before starting, ask the human which person they are (Ivan or Diego) and which block is next. Do only that block, only in that owner's files.

| # | Owner | Branch | Block | Done when |
|---|---|---|---|---|
| 0 | Ivan + Diego | `ivan_dev` / `diego_dev` | This README (v2) and `pipeline/__init__.py` | Both agree and have it on their branch |
| 1 | Ivan | `ivan_dev` | `analyze_trend` in `trend.py` with the database method above | `pytest pipeline/tests` passes with synthetic tests (known trend, negative trend, seasonal no-trend, white-noise false-positive rate, autocorrelated no-trend, gaps, < 120 months, bad input) |
| 1 | Diego | `diego_dev` | `Series`, `Series.validate()` and `from_start_month()` (fill codes, NaN and infinity to `None`; non-numbers rejected). `load_csv()` postponed: only needed if a CSV source appears | Tests pass for gaps, fill codes, NaN, malformed start month, unsorted/duplicated/missing dates, bad metadata |
| 2 | Ivan | `ivan_dev` | Robustness: optional annual-mean trend, warning when the series has many gaps | New tests pass, old ones still pass |
| 2 | Diego | `diego_dev` | `build_case` + `write_case` + `trend_from_db`, using the stub `analyze_trend` until block 1 of Ivan is merged | Output passes `./scripts/check.sh` (contract validator) |
| 3 | Ivan + Diego (humans, cross) | — | Each human writes 2-3 tests of the other's code in `tests/stats/` (agents never edit this folder) | They pass, or a bug line goes to the owner |
| 4 | Diego | `diego_dev` | Adapter `pipeline/sources/supabase_export.py`: reads the JSON export (`series` + `trends`) into `Series` + trend dict | Returns a valid `Series` for the cell nearest to Salamanca |
| 4 | Ivan | `ivan_dev` | `explain(trend, series) -> str` in `explain.py`: plain-English facts for the AI checker | Correct text for one significant and one non-significant case |
| 5 | Diego | `diego_dev` | Featured cases in `data/cache/`, at least one non-significant | `./scripts/check.sh` passes |
| 5 | Ivan | `ivan_dev` | (a) Run `analyze_trend` on the featured cases and compare with the database `trends` rows (slope, p-value, significant). (b) Compare one featured case with Giovanni (direction and rough size) | Differences noted in the SYNC CHECK report; any mismatch in `significant` goes as a bug line |

## Integration
- Each person merges their own branch into `main`, always after the QA checks pass (`./scripts/check.sh`, QA report in `docs/agents/qa.md`).
- After Ivan's block 1 is merged: Diego replaces the stub with the real `analyze_trend` and regenerates his test JSON.
- After Diego's block 4: first real case end to end (JSON export -> `Series` + trend -> `data/cache/` JSON), handed to Yeipi.
- Before Sunday 13:00 (freeze): all featured cases in `data/cache/`, `check.sh` green, `AI_USAGE.md` and `REFERENCES.md` complete.

## Open decisions (team must answer)
1. **Which trend does the game show?** Proposal: the database `trends` row (via `trend_from_db`); Ivan's `analyze_trend` is the independent check (block 5a) and the fallback for any series not in the database. Needs OK from Ivan and the database owner.
2. **Duplicated dates in a CSV:** error or average? Diego will decide; for now they raise `ValueError`.
3. **Exact `pymannkendall` function** that matches the database script (plain pre-whitening vs trend-free pre-whitening): Ivan to confirm with the database owner.
