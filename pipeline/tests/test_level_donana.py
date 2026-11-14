"""Tests for pipeline.level_donana and the shared pipeline.level_data."""

import json

import pytest

from pipeline.level_donana import OUT_PATH, PRECIP_PATH, SOILM_PATH, build


@pytest.fixture(scope="module")
def data():
    return build()


def test_full_soilm_window_equals_the_case_file(data):
    case = json.loads(SOILM_PATH.read_text(encoding="utf-8"))
    full = data["full"]["soilm"]
    assert full["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
    assert full["p_value"] == pytest.approx(case["p_value"], abs=1e-4)
    assert full["significant"] == case["significant"]
    assert data["windows"]["2000-2026"] == full  # the full-record window is the full record


def test_precip_and_common_period(data):
    case = json.loads(PRECIP_PATH.read_text(encoding="utf-8"))
    assert data["full"]["precip"]["slope_decade"] == pytest.approx(case["slope"] * 10, abs=1e-4)
    assert data["full"]["precip"]["significant"] == case["significant"]
    assert (data["common"]["first"], data["common"]["last"]) == ("2000-01", "2025-09")
    n = data["common"]["soilm"]["n_months"]
    assert n == data["common"]["precip"]["n_months"] == 309


def test_windows_cover_every_year_pair(data):
    w = data["windows"]
    years = range(2000, 2027)
    assert set(w) == {f"{s}-{e}" for s in years for e in years if e >= s}
    assert w["2020-2026"] == {"too_short": True}  # fewer than 120 months


def test_committed_json_is_current(data):
    committed = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    assert committed == data
    assert OUT_PATH.stat().st_size < 80_000


def test_filomena_json_unchanged_by_the_refactor():
    """level_filomena now uses pipeline/level_data.py: its committed JSON must be unchanged.

    Same text up to line endings (a Windows checkout with core.autocrlf=true writes CRLF), and the
    same parsed data."""
    from pipeline.level_filomena import OUT_PATH as FILOMENA_JSON
    from pipeline.level_filomena import build as build_filomena

    built = build_filomena()
    text = json.dumps(built, separators=(",", ":")) + "\n"
    committed = FILOMENA_JSON.read_bytes().replace(b"\r\n", b"\n").decode("utf-8")
    assert committed == text
    assert json.loads(committed) == built
