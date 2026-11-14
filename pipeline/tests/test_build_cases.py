"""Tests for pipeline.build_cases: one case from a fake raw POWER file passes the contract validator."""

import importlib.util
import json
from pathlib import Path

import numpy as np

from pipeline.build_cases import build_index, build_one, case_vars, write_index
from pipeline.cases import CASES
from pipeline.build_case import CONTRACT_FIELDS

ROOT = Path(__file__).resolve().parents[2]


def _validator():
    spec = importlib.util.spec_from_file_location("validate_contract", ROOT / "scripts" / "validate_contract.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _fake_raw(param, years=range(1981, 2001), seed=0):
    rng = np.random.default_rng(seed)
    data = {}
    for year in years:
        for month in range(1, 13):
            t = year - 1981 + (month - 1) / 12
            data[f"{year}{month:02d}"] = round(15 + 8 * np.sin(2 * np.pi * t) + 0.03 * t + rng.normal(0, 0.5), 2)
        data[f"{year}13"] = 15.0
    data["199005"] = -999.0
    return {"header": {"fill_value": -999.0}, "parameters": {param: {"units": "C"}},
            "properties": {"parameter": {param: data}}}


def test_build_one_from_raw_file_passes_contract(tmp_path):
    raw_dir, cache_dir = tmp_path / "raw", tmp_path / "cache"
    raw_dir.mkdir()
    case = {"id": "test_case", "place": "Testville", "lat": 40.0, "lon": -3.0, "variables": ["T2M"]}
    (raw_dir / "test_case_T2M.json").write_text(json.dumps(_fake_raw("T2M")))

    contract_case, trend, _ = build_one(case, "T2M", raw_dir=raw_dir, cache_dir=cache_dir)

    out = cache_dir / "case_test_case_T2M.json"
    assert out.exists()
    assert _validator().check(str(out)) == []
    written = json.loads(out.read_text(encoding="utf-8"))
    assert set(written) == set(CONTRACT_FIELDS)
    assert written["dataset"] == "NASA POWER (MERRA-2 based) T2M"
    assert len(written["dates"]) == 240 and written["values"][written["dates"].index("1990-05")] is None
    assert written["slope"] == trend["slope"]


def test_cases_index(tmp_path):
    path = tmp_path / "cases_index.json"
    write_index(path)
    index = json.loads(path.read_text(encoding="utf-8"))
    assert index == build_index()
    assert [e["id"] for e in index] == [c["id"] for c in CASES]
    for entry in index:
        assert set(entry) == {"id", "title", "place", "lat", "lon", "question", "context", "files", "facts"}
        assert set(entry["facts"]) == {f.rsplit("_", 1)[1][:-5] for f in entry["files"]}
        for var, text in entry["facts"].items():
            assert f"Variable: {var}" in text and "Mann-Kendall p-value:" in text
        assert entry["question"].endswith("?") and entry["context"] and "TODO" not in entry["context"]
        assert all(f.startswith("data/cache/case_") for f in entry["files"])
        assert all((ROOT / f).exists() for f in entry["files"])  # the committed case files
    assert index[0]["files"] == ["data/cache/case_dana_valencia_PRECTOTCORR.json",
                                 "data/cache/case_dana_valencia_T2M.json"]


def test_featured_cases_cover_the_brief():
    """README v4: about 10 featured cases, at least one non-significant (committed files)."""
    assert len(CASES) == 10
    assert len({c["id"] for c in CASES}) == 10
    files = [ROOT / f for entry in build_index() for f in entry["files"]]
    significant = [json.loads(f.read_text(encoding="utf-8"))["significant"] for f in files]
    assert False in significant


def test_results_table_and_methods_doc():
    from pipeline.results_table import END, START, replace_table, results_table

    table = results_table()
    assert len(table.splitlines()) == 2 + sum(len(c["variables"]) for c in CASES)
    assert "| Valencia DANA | T2M | +0.272 °C |" in table
    doc = (ROOT / "docs" / "methods.md").read_text(encoding="utf-8")
    assert replace_table(doc, table) == doc  # the committed doc holds the current table
    assert replace_table(f"a{START}old{END}b", "T") == f"a{START}\nT\n{END}b"


def test_power_source_reproduces_committed_case_files(tmp_path):
    """--source power (default) rebuilds every committed case file byte for byte from data/raw/power/."""
    from pipeline.build_cases import RAW_DIR, case_file, case_vars

    for case in CASES:
        for variable in case["variables"]:
            build_one(case, variable, raw_dir=RAW_DIR, cache_dir=tmp_path, source="power")
        for name in case_vars(case):
            committed = ROOT / case_file(case["id"], name)
            assert (tmp_path / committed.name).read_bytes() == committed.read_bytes()


def test_variable_ids_and_sources():
    import pytest

    from pipeline.build_cases import SOURCES, get_series, main, output_var
    from pipeline.cases import POWER_PARAMS, VARIABLES

    assert set(SOURCES) == {"power", "case_export"}
    assert all(v in VARIABLES for c in CASES for v in c["variables"])
    assert set(POWER_PARAMS) <= set(VARIABLES)
    assert output_var("PRECIP") == "PRECTOTCORR" and output_var("SOILM") == "GWETTOP"
    assert output_var("NDVI") is None and output_var("NDVI", "case_export") == "NDVI"
    with pytest.raises(ValueError, match="--export-dir"):
        get_series(CASES[0], "T2M", "case_export")
    with pytest.raises(ValueError, match="unknown source"):
        get_series(CASES[0], "T2M", "nope")
    with pytest.raises(SystemExit):
        main(["--source", "nope"])


def _fake_export(path, months=180):
    """Tiny export: 2 cases (dana_valencia: precip + T2M; donana: soilmoist + NDVI), no PRECIP for donana."""
    rng = np.random.default_rng(1)

    def entry(base, slope, amp):
        vals = [round(base + amp * np.sin(2 * np.pi * i / 12) + slope * i / 12 + rng.normal(0, amp / 10), 4)
                for i in range(months)]
        vals[5] = None
        return {"start_month": "2000-01-01", "values": vals, "climatology": [0.0] * 12}

    (path / "cases").mkdir(parents=True)
    variables = {"T2M": {"unit": "K", "source": "NASA M2TMNXSLV v5.12.4"},
                 "precip": {"unit": "mm/hr", "source": "NASA GPM_3IMERGM v07"},
                 "soilmoist": {"units": "kg/m2", "dataset": "NASA GLDAS_NOAH025_M v2.1"},
                 "NDVI": {"unit": "NDVI", "source": "NASA MOD13A3 v061"}}
    (path / "variables.json").write_text(json.dumps(variables), encoding="utf-8")
    cases = {
        "dana_valencia": {"case_id": "dana_valencia", "lat_min": 39.2, "lat_max": 39.6, "lon_min": -0.7,
                          "lon_max": -0.3, "vars": {"precip": entry(0.07, 0.0, 0.05), "T2M": entry(291, 0.03, 6)}},
        "donana": {"case_id": "donana", "lat_min": 36.8, "lat_max": 37.2, "lon_min": -6.6, "lon_max": -6.2,
                   "vars": {"soilmoist": entry(20, -0.1, 5), "NDVI": entry(0.4, 0.002, 0.1), "wind": entry(3, 0, 1)}},
    }
    for cid, data in cases.items():
        (path / "cases" / f"{cid}.json").write_text(json.dumps(data), encoding="utf-8")


def test_case_export_builds_replaces_and_falls_back(tmp_path):
    import shutil

    from pipeline.build_cases import build_from_export, write_index

    export, root = tmp_path / "export", tmp_path / "repo"
    _fake_export(export)
    cache = root / "data" / "cache"
    cache.mkdir(parents=True)
    cases = [c for c in CASES if c["id"] in ("dana_valencia", "donana")]
    for c in cases:  # start from the committed POWER files
        for name in case_vars(c):
            shutil.copy(ROOT / "data" / "cache" / f"case_{c['id']}_{name}.json", cache)
    donana_precip_before = (cache / "case_donana_PRECTOTCORR.json").read_bytes()

    report = build_from_export(export, cases, cache_dir=cache, log=lambda *_: None)

    assert report["built"] == ["dana_valencia/PRECIP", "dana_valencia/T2M", "donana/SOILM", "donana/NDVI"]
    assert sorted(report["replaced"]) == ["case_dana_valencia_PRECTOTCORR.json", "case_donana_GWETTOP.json"]
    assert report["fallback"] == ["donana/PRECIP"] and report["missing"] == []
    assert report["ignored"] == ["donana/wind"]
    assert sorted(p.name for p in cache.glob("*.json")) == [
        "case_dana_valencia_PRECIP.json", "case_dana_valencia_T2M.json", "case_donana_NDVI.json",
        "case_donana_PRECTOTCORR.json", "case_donana_SOILM.json"]
    assert (cache / "case_donana_PRECTOTCORR.json").read_bytes() == donana_precip_before  # fallback kept
    for f in cache.glob("*.json"):
        assert _validator().check(str(f)) == []
    t2m = json.loads((cache / "case_dana_valencia_T2M.json").read_text(encoding="utf-8"))
    assert (t2m["units"], t2m["dataset"], t2m["lat"], t2m["lon"]) == ("°C", "NASA M2TMNXSLV v5.12.4", 39.4, -0.5)
    assert t2m["dates"][0] == "2000-01" and t2m["values"][5] is None
    soil = json.loads((cache / "case_donana_SOILM.json").read_text(encoding="utf-8"))
    assert soil["units"] == "kg/m² (0-10 cm)" and soil["variable"] == "SOILM"

    write_index(root / "data" / "cases_index.json", cases, root)
    index = json.loads((root / "data" / "cases_index.json").read_text(encoding="utf-8"))
    assert index[0]["files"] == ["data/cache/case_dana_valencia_PRECIP.json", "data/cache/case_dana_valencia_T2M.json"]
    assert index[1]["files"] == ["data/cache/case_donana_SOILM.json", "data/cache/case_donana_PRECTOTCORR.json",
                                 "data/cache/case_donana_NDVI.json"]
    assert set(index[1]["facts"]) == {"SOILM", "PRECTOTCORR", "NDVI"}


def test_case_export_clear_errors(tmp_path):
    import pytest

    from pipeline.build_cases import build_from_export
    from pipeline.sources.case_export import load_case

    with pytest.raises(FileNotFoundError, match="variables.json"):
        build_from_export(tmp_path, CASES[:1], cache_dir=tmp_path, log=lambda *_: None)
    (tmp_path / "variables.json").write_text("{}", encoding="utf-8")
    with pytest.raises(FileNotFoundError, match="no cases/ folder.*variables.json"):
        load_case(tmp_path, "donana")
    (tmp_path / "cases").mkdir()
    assert load_case(tmp_path, "donana") is None
    (tmp_path / "cases" / "donana.json").write_text(json.dumps({"id": "donana", "south": 1, "north": 2,
                                                                 "west": 3, "east": 4, "data": {}}))
    with pytest.raises(ValueError, match=r"missing field 'vars'.*found fields: \['data', 'east'"):
        load_case(tmp_path, "donana")


def test_convert_units():
    import warnings

    import pytest

    from pipeline.build_cases import convert_units

    assert convert_units("T2M", "K", [273.15, None, 300.0]) == ([0.0, None, pytest.approx(26.85)], "°C")
    assert convert_units("LST", "kelvin", [283.15])[1] == "°C"
    assert convert_units("PRECIP", "mm/hr", [0.5, None]) == ([12.0, None], "mm/day")
    assert convert_units("SOILM", "kg/m2", [20.0]) == ([20.0], "kg/m² (0-10 cm)")
    assert convert_units("NDVI", "", [0.4])[1] == "NDVI (0-1)"
    assert convert_units("SNOW", "%", [50])[1] == "%"
    with pytest.warns(UserWarning, match="unknown unit"):
        assert convert_units("PRECIP", "inch/week", [1.0]) == ([1.0], "inch/week")
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        convert_units("T2M", "K", [280.0])


def _export_with_units(path, unit_t, unit_p, t_values, p_values):
    (path / "cases").mkdir(parents=True)
    (path / "variables.json").write_text(json.dumps({
        "T2M": {"unit": unit_t, "source": "S"}, "PRECIP": {"unit": unit_p, "source": "S"}}), encoding="utf-8")
    case = {"case_id": "dana_valencia", "lat_min": 39.2, "lat_max": 39.6, "lon_min": -0.7, "lon_max": -0.3,
            "vars": {"T2M": {"start_month": "2000-01", "values": t_values},
                     "PRECIP": {"start_month": "2000-01", "values": p_values}}}
    (path / "cases" / "dana_valencia.json").write_text(json.dumps(case), encoding="utf-8")


def test_case_export_unit_conversion_scales_slopes(tmp_path):
    """K -> °C leaves the slope unchanged; mm/hr -> mm/day multiplies it by 24."""
    import pytest

    rng = np.random.default_rng(3)
    n = 240
    t_c = [15 + 8 * np.sin(2 * np.pi * i / 12) + 0.003 * i + rng.normal(0, 0.5) for i in range(n)]
    p_day = [max(0.0, 1.5 + np.sin(2 * np.pi * i / 12) + 0.002 * i + rng.normal(0, 0.3)) for i in range(n)]
    case = next(c for c in CASES if c["id"] == "dana_valencia")

    native, display = tmp_path / "native", tmp_path / "display"
    _export_with_units(native, "K", "mm/hr", [v + 273.15 for v in t_c], [v / 24 for v in p_day])
    with pytest.warns(UserWarning):  # "C/day-like" labels are unknown units: kept as they are
        _export_with_units(display, "degC", "mm/d", t_c, p_day)
        _, t_ref, _ = build_one(case, "T2M", cache_dir=tmp_path / "c1", source="case_export", export_dir=display)
        _, p_ref, _ = build_one(case, "PRECIP", cache_dir=tmp_path / "c1", source="case_export", export_dir=display)

    t_case, t_trend, _ = build_one(case, "T2M", cache_dir=tmp_path / "c2", source="case_export", export_dir=native)
    p_case, p_trend, _ = build_one(case, "PRECIP", cache_dir=tmp_path / "c2", source="case_export", export_dir=native)
    assert t_case["units"] == "°C" and p_case["units"] == "mm/day"
    assert t_case["values"][0] == pytest.approx(t_c[0])
    assert t_trend["slope"] == pytest.approx(t_ref["slope"], rel=1e-6)
    assert p_trend["slope"] == pytest.approx(p_ref["slope"], rel=1e-6)

    raw = tmp_path / "raw"
    _export_with_units(raw, "K", "mm/hr", [v + 273.15 for v in t_c], [v / 24 for v in p_day])
    from pipeline.sources.case_export import load_case
    from pipeline.trend import analyze_trend
    from pipeline.series import from_start_month
    entry = load_case(raw, "dana_valencia")["vars"]["PRECIP"]
    s = from_start_month(entry["start_month"], entry["values"], place="x", lat=0, lon=0, variable="PRECIP",
                         units="mm/hr", dataset="S")
    assert p_trend["slope"] == pytest.approx(24 * analyze_trend(s.dates, s.values)["slope"], rel=1e-6)
    s = from_start_month(load_case(raw, "dana_valencia")["vars"]["T2M"]["start_month"],
                         load_case(raw, "dana_valencia")["vars"]["T2M"]["values"], place="x", lat=0, lon=0,
                         variable="T2M", units="K", dataset="S")
    assert t_trend["slope"] == pytest.approx(analyze_trend(s.dates, s.values)["slope"], rel=1e-6)
