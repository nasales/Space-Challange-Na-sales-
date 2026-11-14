"""Turn a `Series` + trend result into a contract JSON for the game (Interface 3 in pipeline/README.md).

Only the required fields of docs/contract.md go into the JSON.
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import Path
from typing import Callable

from pipeline.series import Series, normalize_month

CONTRACT_FIELDS = (
    "place", "lat", "lon", "variable", "units", "dataset",
    "dates", "values", "slope", "p_value", "significant", "test",
)
ALPHA = 0.05  # docs/contract.md: significant means p_value < 0.05
MIN_POINTS = 24  # same minimum as scripts/validate_contract.py
STUB_TEST = "stub"
DB_TEST = "mann-kendall-prewhitened"  # Mann-Kendall with Yue-Wang 2002 pre-whitening
DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "cache"


# ---------- trend sources ----------


def stub_analyze_trend(dates: list[str], values: list[float | None], alpha: float = 0.05) -> dict:
    """Placeholder with the same signature as Ivan's analyze_trend. Never use it for real cases."""
    return {"slope": 0.0, "p_value": 1.0, "significant": False, "test": STUB_TEST}


def get_analyze_trend() -> Callable[..., dict]:
    """Ivan's analyze_trend if pipeline/trend.py exists, otherwise the stub.

    If trend.py exists but fails to import (e.g. a missing library), the error is raised
    instead of silently falling back to the stub.
    """
    try:
        from pipeline.trend import analyze_trend
    except ModuleNotFoundError as e:
        if e.name != "pipeline.trend":
            raise
        return stub_analyze_trend
    return analyze_trend


def trend_from_db(row: dict) -> dict:
    """Convert a Supabase `trends` row into the analyze_trend dict shape (slope per year)."""
    required = ("slope_per_decade", "p_value", "significant")
    missing = [k for k in required if row.get(k) is None]
    if missing:
        raise ValueError(f"trends row is missing {missing}")

    trend = {
        "slope": _per_year(row["slope_per_decade"], "slope_per_decade"),
        "p_value": row["p_value"],
        "significant": row["significant"],
        "test": DB_TEST,
    }
    for src, dst in (("slope_ci_low", "slope_ci_low"), ("slope_ci_high", "slope_ci_high")):
        if row.get(src) is not None:
            trend[dst] = _per_year(row[src], src)
    for src, dst in (
        ("mk_tau", "mk_tau"),
        ("n_months", "n_points"),
        ("period_start", "start"),
        ("period_end", "end"),
        ("direction", "direction"),
        ("mean_value", "mean_value"),
    ):
        if row.get(src) is not None:
            trend[dst] = row[src]
    for key in ("start", "end"):  # database dates "2000-01-01" -> "2000-01"
        if key in trend:
            trend[key] = normalize_month(trend[key])
    return trend


# ---------- case building ----------


def build_case(series: Series, trend: dict) -> dict:
    """Return a dict with exactly the required fields of docs/contract.md. Raises ValueError if invalid."""
    series.validate()

    n_valid = sum(v is not None for v in series.values)
    if len(series.values) < MIN_POINTS:
        raise ValueError(f"only {len(series.values)} months; the contract needs at least {MIN_POINTS}")
    if n_valid == 0:
        raise ValueError("all values are null")

    missing = [k for k in ("slope", "p_value", "significant", "test") if k not in trend]
    if missing:
        raise ValueError(f"trend is missing {missing}")
    slope, p_value, significant, test = trend["slope"], trend["p_value"], trend["significant"], trend["test"]

    if not _is_number(slope) or not math.isfinite(slope):
        raise ValueError(f"slope must be a finite number, got {slope!r}")
    if not _is_number(p_value) or not 0 <= p_value <= 1:
        raise ValueError(f"p_value must be a number between 0 and 1, got {p_value!r}")
    if not isinstance(significant, bool):
        raise ValueError(f"significant must be true or false, got {significant!r}")
    if significant != (p_value < ALPHA):
        raise ValueError(
            f"significant={significant} does not match p_value={p_value} < {ALPHA} (contract rule)"
        )
    if not isinstance(test, str) or not test.strip():
        raise ValueError("test must be a non-empty string")

    return {
        "place": series.place,
        "lat": float(series.lat),
        "lon": float(series.lon),
        "variable": series.variable,
        "units": series.units,
        "dataset": series.dataset,
        "dates": list(series.dates),
        "values": list(series.values),
        "slope": float(slope),
        "p_value": float(p_value),
        "significant": significant,
        "test": test,
    }


def case_id(place: str, variable: str) -> str:
    """'Salamanca', 'tair' -> 'salamanca_tair' (ASCII, lowercase, safe as a file name)."""
    return f"{_slug(place)}_{_slug(variable)}"


def case_path(case: dict, cache_dir: str | Path = DEFAULT_CACHE_DIR) -> Path:
    """Default location of a case: data/cache/<place>_<variable>.json."""
    return Path(cache_dir) / f"{case_id(case['place'], case['variable'])}.json"


def write_case(case: dict, path: str | Path, *, allow_stub: bool = False) -> None:
    """Write a case as UTF-8 JSON. Refuses cases computed with the stub unless allow_stub=True."""
    extra = set(case) - set(CONTRACT_FIELDS)
    if extra:
        raise ValueError(f"fields not in the contract: {sorted(extra)}")
    if case.get("test") == STUB_TEST and not allow_stub:
        raise ValueError("refusing to write a case computed with the stub analyze_trend")

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(case, f, ensure_ascii=False, allow_nan=False, indent=1)
        f.write("\n")


# ---------- private ----------


def _is_number(x: object) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def _per_year(value: object, name: str) -> float:
    if not _is_number(value) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number, got {value!r}")
    return float(value) / 10.0


def _slug(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    if not slug:
        raise ValueError(f"cannot build a file name from {text!r}")
    return slug
