"""Tests for pipeline.cross_check with fake case files and fake POWER raw files."""

import json

import numpy as np

from pipeline.cross_check import END, START, compare, replace_section, section, summary

CASE = {"id": "fake", "title": "Fake place"}


def _months(y0, y1):
    return [f"{y}-{m:02d}" for y in range(y0, y1 + 1) for m in range(1, 13)]


def _values(dates, slope, seed, base=15.0, amp=5.0, noise=0.3):
    rng = np.random.default_rng(seed)
    return [round(base + amp * np.sin(2 * np.pi * i / 12) + slope * i / 12 + rng.normal(0, noise), 4)
            for i in range(len(dates))]


def _case_file(cache, variable, dates, values, dataset):
    data = {"place": "Fake", "lat": 40.0, "lon": -3.0, "variable": variable, "units": "u", "dataset": dataset,
            "dates": dates, "values": values, "slope": 0.0, "p_value": 1.0, "significant": False, "test": "mk"}
    (cache / f"case_fake_{variable}.json").write_text(json.dumps(data), encoding="utf-8")


def _power_raw(raw, param, dates, values):
    data = {f"{d[:4]}{d[5:]}": v for d, v in zip(dates, values)}
    for y in sorted({d[:4] for d in dates}):
        data[f"{y}13"] = 0.0  # annual value, ignored by the parser
    raw_json = {"header": {"fill_value": -999.0}, "parameters": {param: {"units": "C"}},
                "properties": {"parameter": {param: data}}}
    (raw / f"fake_{param}.json").write_text(json.dumps(raw_json), encoding="utf-8")


def test_compare_on_common_period(tmp_path):
    cache, raw = tmp_path / "cache", tmp_path / "raw"
    cache.mkdir(), raw.mkdir()
    # T2M: case 1985-2026, POWER 1981-2024 -> common 1985-01..2024-12; same warming in both.
    case_dates, power_dates = _months(1985, 2026), _months(1981, 2024)
    _case_file(cache, "T2M", case_dates, _values(case_dates, 0.04, 1), "NASA M2TMNXSLV v5.12.4")
    _power_raw(raw, "T2M", power_dates, _values(power_dates, 0.02, 2))
    # PRECIP: opposite signs (case drying, POWER wetting).
    p_dates = _months(1998, 2024)
    _case_file(cache, "PRECIP", p_dates, _values(p_dates, -0.05, 3, base=2, amp=1, noise=0.05), "NASA GPM_3IMERGM v07")
    _power_raw(raw, "PRECTOTCORR", p_dates, _values(p_dates, 0.05, 4, base=2, amp=1, noise=0.05))
    # SOILM: no POWER file -> not compared.
    _case_file(cache, "SOILM", p_dates, _values(p_dates, -0.1, 5, base=20), "NASA GLDAS_NOAH025_M v2.1")

    rows = compare([CASE], cache_dir=cache, raw_dir=raw)
    assert [r["variable"] for r in rows] == ["T2M", "PRECIP"]
    t2m, precip = rows
    assert t2m["period"] == "1985-01 to 2024-12"
    assert t2m["same_direction"] and t2m["same_significance"] and t2m["case_sig"]
    assert 1.6 < t2m["ratio"] < 2.4  # 0.04 vs 0.02 per year
    assert not precip["same_direction"] and precip["ratio"] < 0
    assert summary(rows) == {"n": 2, "direction": 1, "n_sig": 2, "significance": 2}

    text = section(rows, missing=["Fake place SOILM"])
    assert "Direction agrees in 1 of 2 series" in text and "Not compared (no POWER file): Fake place SOILM." in text
    assert "| Fake place | PRECIP / PRECTOTCORR | 1998-01 to 2024-12 | down / up |" in text


def test_soil_moisture_is_direction_only_and_power_case_files_are_skipped(tmp_path):
    cache, raw = tmp_path / "cache", tmp_path / "raw"
    cache.mkdir(), raw.mkdir()
    dates = _months(2000, 2020)
    _case_file(cache, "SOILM", dates, _values(dates, -0.2, 6, base=20), "NASA GLDAS_NOAH025_M v2.1")
    _power_raw(raw, "GWETTOP", dates, _values(dates, -0.002, 7, base=0.5, amp=0.1, noise=0.01))
    _case_file(cache, "T2M", dates, _values(dates, 0.03, 8), "NASA POWER (MERRA-2 based) T2M")  # POWER itself
    _power_raw(raw, "T2M", dates, _values(dates, 0.03, 8))

    rows = compare([CASE], cache_dir=cache, raw_dir=raw)
    assert [r["variable"] for r in rows] == ["SOILM"]
    assert rows[0]["same_direction"] and rows[0]["same_significance"] is None and rows[0]["ratio"] is None
    assert "n/a (different quantity) | direction |" in section(rows, missing=[])


def test_replace_section_is_regenerable():
    doc = "# M\n\n## Results of the featured cases\nT\n"
    once = replace_section(doc, "A")
    assert once == f"# M\n\n## Cross-dataset check\n{START}\nA\n{END}\n\n## Results of the featured cases\nT\n"
    assert replace_section(once, "B") == once.replace("\nA\n", "\nB\n")
    assert replace_section(replace_section(once, "B"), "A") == once


def test_methods_doc_holds_current_section():
    from pipeline.cross_check import METHODS_PATH

    doc = METHODS_PATH.read_text(encoding="utf-8")
    assert replace_section(doc, section(compare())) == doc
