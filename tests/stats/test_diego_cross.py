"""Block 3 cross tests: Ivan tests Diego's code (pipeline/series.py, pipeline/build_case.py).

Written by an agent at Ivan's explicit request and reviewed by Ivan before commit (AGENTS.md rule 3).
"""

import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

from pipeline.build_case import build_case
from pipeline.series import Series, from_start_month
from pipeline.trend import analyze_trend

ROOT = Path(__file__).resolve().parents[2]


def _validator():
    """scripts/validate_contract.py loaded by path (scripts/ is not a package)."""
    spec = importlib.util.spec_from_file_location("validate_contract", ROOT / "scripts" / "validate_contract.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _series(dates, values):
    return Series(place="Salamanca", lat=40.875, lon=-5.625, variable="tair", units="°C",
                  dataset="GLDAS-2.1 Noah", dates=dates, values=values)


# a) validate() rejects unsorted and duplicated dates ------------------------------------------

def test_validate_rejects_unsorted_dates():
    with pytest.raises(ValueError):
        _series(["2000-01", "2000-03", "2000-02"], [1.0, 2.0, 3.0]).validate()


def test_validate_rejects_duplicated_dates():
    with pytest.raises(ValueError):
        _series(["2000-01", "2000-02", "2000-02"], [1.0, 2.0, 3.0]).validate()


# b) fill code and missing month become None, dates stay consecutive --------------------------
# load_csv does not exist yet (pipeline/README.md: "later, only if needed"), so this checks the
# same rules on from_start_month, the constructor used for the database export.

def test_fill_code_and_missing_month_become_none():
    s = from_start_month("1999-11-01", [5.0, -9999, None, 7.5], place="Salamanca", lat=40.875,
                         lon=-5.625, variable="tair", units="°C", dataset="GLDAS-2.1 Noah")
    assert s.dates == ["1999-11", "1999-12", "2000-01", "2000-02"]
    assert s.values == [5.0, None, None, 7.5]


# c) build_case on a real analyze_trend result passes the contract validator -------------------

def test_build_case_passes_contract_validator(tmp_path):
    rng = np.random.default_rng(42)
    n = 15 * 12
    t = np.arange(n) / 12
    values = [float(v) for v in 12 + 8 * np.sin(2 * np.pi * t) + 0.04 * t + rng.normal(0, 0.5, n)]
    dates = [f"{2005 + k // 12}-{k % 12 + 1:02d}" for k in range(n)]
    series = _series(dates, values)

    case = build_case(series, analyze_trend(dates, values))
    path = tmp_path / "salamanca_tair.json"
    path.write_text(json.dumps(case, ensure_ascii=False), encoding="utf-8")

    assert _validator().check(str(path)) == []
