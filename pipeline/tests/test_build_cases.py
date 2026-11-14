"""Tests for pipeline.build_cases: one case from a fake raw POWER file passes the contract validator."""

import importlib.util
import json
from pathlib import Path

import numpy as np

from pipeline.build_cases import build_index, build_one, write_index
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

    assert set(SOURCES) == {"power", "supabase_cases"}
    assert all(v in VARIABLES for c in CASES for v in c["variables"])
    assert set(POWER_PARAMS) <= set(VARIABLES)
    assert output_var("PRECIP") == "PRECTOTCORR" and output_var("SOILM") == "GWETTOP"
    assert output_var("NDVI") is None and output_var("NDVI", "supabase_cases") == "NDVI"
    with pytest.raises(NotImplementedError, match="supabase_cases"):
        get_series(CASES[0], "T2M", "supabase_cases")
    with pytest.raises(ValueError, match="unknown source"):
        get_series(CASES[0], "T2M", "nope")
    with pytest.raises(SystemExit):
        main(["--source", "nope"])
