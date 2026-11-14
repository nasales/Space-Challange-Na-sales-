"""Tests for pipeline.level_aneto."""

import json

import pytest

from pipeline.level_aneto import OUT_PATH, PRECIP_PATH, T2M_PATH, build, verdict
from pipeline.build_cases import CACHE_DIR


@pytest.fixture(scope="module")
def data():
    return build()


def test_full_results_equal_the_case_files(data):
    for key, path in (("t2m", T2M_PATH), ("precip", PRECIP_PATH)):
        case = json.loads(path.read_text(encoding="utf-8"))
        full = data["full"][key]
        assert full["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
        assert full["p_value"] == pytest.approx(case["p_value"], abs=1e-4)
        assert full["significant"] == case["significant"]
    assert data["full"]["t2m"]["significant"] is True
    assert data["full"]["precip"]["significant"] is False


def test_race_has_every_t2m_case_sorted_and_matching_its_file(data):
    rows = data["race"]
    assert {r["case_id"] for r in rows} == {p.stem[5:-4] for p in CACHE_DIR.glob("case_*_T2M.json")}
    assert len(rows) == 7
    slopes = [r["slope_decade"] for r in rows]
    assert slopes == sorted(slopes, reverse=True)
    for r in rows:
        case = json.loads((CACHE_DIR / f"case_{r['case_id']}_T2M.json").read_text(encoding="utf-8"))
        assert r["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
        assert r["ci_decade"][0] <= r["slope_decade"] <= r["ci_decade"][1]


def test_aneto_fastest_but_not_clearly(data):
    v = data["verdict"]
    assert data["race"][0]["case_id"] == "aneto_glacier"
    assert v["fastest_estimate"] is True
    assert v["clearly_fastest"] is False
    assert "filomena_madrid" in v["overlapping"]


def _row(case_id, lo, mid, hi):
    return {"case_id": case_id, "slope_decade": mid, "ci_decade": [lo, hi]}


def test_verdict_rules():
    clear = [_row("aneto_glacier", 0.5, 0.6, 0.7), _row("b", 0.1, 0.2, 0.3)]
    assert verdict(clear) == {"fastest_estimate": True, "overlapping": [], "clearly_fastest": True}
    overlap = [_row("aneto_glacier", 0.25, 0.4, 0.55), _row("b", 0.2, 0.3, 0.4)]
    assert verdict(overlap) == {"fastest_estimate": True, "overlapping": ["b"], "clearly_fastest": False}
    slower = [_row("b", 0.5, 0.6, 0.7), _row("aneto_glacier", 0.1, 0.2, 0.3)]
    assert verdict(slower) == {"fastest_estimate": False, "overlapping": [], "clearly_fastest": False}


def test_committed_json_is_current(data):
    assert json.loads(OUT_PATH.read_text(encoding="utf-8")) == data
    assert OUT_PATH.stat().st_size < 80_000
