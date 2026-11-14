"""analyze_trend must give the same answer as the database script (trend_stats in etl_espana.py)."""

import importlib.util
import sys
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip("xarray")  # etl_espana.py imports xarray at module level

from pipeline.trend import analyze_trend
from pipeline.tests.test_trend import _make_series

ETL_PATH = Path(__file__).resolve().parents[2] / "archivos_preSupabase" / "etl_espana.py"


@pytest.fixture(scope="module")
def etl():
    spec = importlib.util.spec_from_file_location("etl_espana", ETL_PATH)
    module = importlib.util.module_from_spec(spec)
    # Register before executing: its @dataclass needs the module in sys.modules.
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    yield module
    sys.modules.pop(spec.name, None)


def _with_gaps(dates, values, seed, share=0.1):
    rng = np.random.default_rng(seed)
    for k in rng.choice(len(values), size=int(len(values) * share), replace=False):
        values[k] = None
    return dates, values


SERIES = {
    "positive_trend": _make_series(trend=0.03, seed=1),
    "negative_trend": _make_series(trend=-0.05, seed=2),
    "no_trend": _make_series(trend=0.0, seed=3),
    "ar1": _make_series(trend=0.0, phi=0.6, noise_sd=1.0, seed=5),
    "gaps": _with_gaps(*_make_series(trend=0.03, seed=7), seed=8),
}


@pytest.mark.parametrize("name", SERIES)
def test_matches_db(etl, name):
    dates, values = SERIES[name]
    ours = analyze_trend(dates, values)

    db_values = np.array([np.nan if v is None else v for v in values], dtype=float)
    db_months = np.array(dates, dtype="datetime64[M]")
    db = etl.trend_stats(db_values, db_months)

    rel = 1e-9
    assert ours["slope"] == pytest.approx(db["slope_per_decade"] / 10, rel=rel)
    assert ours["p_value"] == pytest.approx(db["p_value"], rel=rel)
    assert ours["significant"] == db["significant"]
    assert ours["mk_tau"] == pytest.approx(db["mk_tau"], rel=rel)
    assert ours["slope_ci_low"] == pytest.approx(db["slope_ci_low"] / 10, rel=rel)
    assert ours["slope_ci_high"] == pytest.approx(db["slope_ci_high"] / 10, rel=rel)
    assert ours["direction"] == db["direction"]
