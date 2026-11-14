# pipeline/ — statistics module (Ivan + Diego)

This file is the agreement between the two owners of `pipeline/`.
Change it only after telling the other person. Code follows this file, not the other way round.

## Who owns what
| File | Owner |
|---|---|
| `pipeline/__init__.py`, `pipeline/trend.py`, `pipeline/explain.py`, `pipeline/tests/test_trend.py`, `pipeline/tests/test_explain.py` | Ivan |
| `pipeline/series.py`, `pipeline/sources/*.py`, `pipeline/build_case.py`, `pipeline/tests/test_series.py`, `pipeline/tests/test_build_case.py`, `data/raw/`, `data/cache/*.json` | Diego |
| `pipeline/requirements.txt`, `AI_USAGE.md`, `REFERENCES.md` | Shared: append lines at the end only |

An agent working for one owner must not edit the other owner's files. Never edit `docs/contract.md` or `tests/stats/`.

## Interface 1 — `Series` (Diego, `pipeline/series.py`)
```python
@dataclass
class Series:
    place: str
    lat: float
    lon: float
    variable: str               # e.g. "surface_temperature"
    units: str                  # e.g. "K"
    dataset: str                # e.g. "NASA POWER T2M (MERRA-2)"
    dates: list[str]            # "YYYY-MM", sorted, monthly, no duplicates
    values: list[float | None]  # same length as dates; None = gap
```
Rules: always monthly, always sorted, gaps are `None` (never NaN or -999). Source adapters convert daily data and fill codes before building a `Series`.

## Interface 2 — `analyze_trend` (Ivan, `pipeline/trend.py`)
```python
def analyze_trend(dates: list[str], values: list[float | None], alpha: float = 0.05) -> dict
```
Returns at least `slope` (units/year), `p_value`, `significant`, `test` (contract names), plus `slope_ci_low`, `slope_ci_high`, `p_value_original_mk`, `n_points`, `start`, `end`, `total_change`, `direction`.
Raises `ValueError` for fewer than 24 non-null points, mismatched lengths or unsorted dates.
Until the real one is merged, Diego uses a stub with the same signature returning
`{"slope": 0.0, "p_value": 1.0, "significant": False, "test": "stub"}`.

## Interface 3 — output (Diego, `pipeline/build_case.py`)
```python
def build_case(series: Series, trend: dict) -> dict   # required fields of docs/contract.md
def write_case(case: dict, path: str) -> None         # writes data/cache/<id>.json
```
Only the contract's required fields go into the JSON. Extra fields need approval from the data owner and Yeipi (contract change).

## Work blocks (do them in order, one block per session, one branch per block)
Before starting, ask the human which person they are (Ivan or Diego) and which block is next. Do only that block, only in that owner's files.

| # | Owner | Branch | Block | Done when |
|---|---|---|---|---|
| 0 | Ivan + Diego | `ivan_dev` | This README and `pipeline/__init__.py` | Both agree and have it on their branch |
| 1 | Ivan | `data/trend-core` | `analyze_trend` in `trend.py`: deseasonalize, Sen slope (`scipy.stats.theilslopes`), Mann-Kendall Hamed-Rao (`pymannkendall`) | `pytest pipeline/tests` passes with synthetic tests (known trend, negative trend, seasonal no-trend, white-noise false-positive rate, gaps, bad input) |
| 1 | Diego | `data/series-io` | `Series`, `Series.validate()`, generic `load_csv()` (columns `date,value`; fill codes and empty cells to `None`; missing months inserted as `None`; daily averaged to monthly) | Tests pass for gaps, fill codes, missing months, daily input, unsorted/duplicated/malformed dates |
| 2 | Ivan | `data/trend-core` | Robustness: optional annual-mean trend, warning when the series is short or has many gaps | New tests pass, old ones still pass |
| 2 | Diego | `data/build-case` | `build_case` + `write_case`, using the stub `analyze_trend` until block 1 of Ivan is merged | Output passes `./scripts/check.sh` (contract validator) |
| 3 | Ivan + Diego (humans, cross) | — | Each human writes 2-3 tests of the other's code in `tests/stats/` (agents never edit this folder) | They pass, or a bug line goes to the owner |
| 4 | Diego | `data/source-<dataset>` | Adapter for the chosen NASA dataset in `pipeline/sources/` | Returns a valid `Series` for Salamanca |
| 4 | Ivan | `data/explain` | `explain(trend, series) -> str` in `explain.py`: plain-English facts for the AI checker | Correct text for one significant and one non-significant case |
| 5 | Diego | `data/featured-cases` | Featured cases in `data/cache/`, at least one non-significant | `./scripts/check.sh` passes |
| 5 | Ivan | `data/giovanni-check` | Compare one featured case with Giovanni (direction and rough size) | Noted in the SYNC CHECK report |

## Integration
- Each person merges their own branches into `main`, always after the QA checks pass (`./scripts/check.sh`, QA report in `docs/agents/qa.md`).
- After Ivan's block 1 is merged: Diego replaces the stub with the real `analyze_trend` and regenerates his test JSON.
- After Diego's block 4: first real case end to end (dataset -> `Series` -> `analyze_trend` -> JSON), handed to Yeipi.
- Before Sunday 13:00 (freeze): all featured cases in `data/cache/`, `check.sh` green, `AI_USAGE.md` and `REFERENCES.md` complete.
