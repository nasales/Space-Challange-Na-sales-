"""Smoke test for pipeline.results_figure: the slide PNG is created from the committed case files."""

from pipeline.results_figure import collect, title_and_footer, write_figure


def test_figure_png_is_created(tmp_path):
    out = write_figure(tmp_path / "figures" / "featured_trends.png")
    assert out.exists() and out.stat().st_size > 10_000
    assert out.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
    width, height = int.from_bytes(out.read_bytes()[16:20], "big"), int.from_bytes(out.read_bytes()[20:24], "big")
    assert (width, height) == (1600, 900)


def test_rows_cover_every_series():
    rows = collect()
    assert set(rows) == {"T2M", "PRECIP", "SOILM"}
    assert sum(len(v) for v in rows.values()) == 19
    assert all(r["lo"] <= r["slope"] <= r["hi"] for v in rows.values() for r in v)


def test_title_and_footer_from_case_files():
    title, footer = title_and_footer(collect())
    assert title == "Featured cases: trend per decade (95% CI), 1980-2026"
    assert footer == ("Data: NASA GLDAS_NOAH025_M v2.1, NASA GPM_3IMERGM v07, NASA M2TMNXSLV v5.12.4. "
                      "Grey = not statistically significant (p >= 0.05)")
    power = {"T2M": [{"source": "NASA POWER (MERRA-2 based)", "first": "1981-01", "last": "2024-12"}]}
    assert title_and_footer(power)[0] == "Featured cases: trend per decade (95% CI), NASA POWER 1981-2024"
    mixed = {"T2M": [{"source": "NASA POWER (MERRA-2 based)", "first": "1981-01", "last": "2024-12"}],
             "NDVI": [{"source": "NASA MOD13A3 v061", "first": "2000-02", "last": "2025-10"}]}
    title, footer = title_and_footer(mixed)
    assert title == "Featured cases: trend per decade (95% CI), 1981-2025"
    assert footer.startswith("Data: NASA MOD13A3 v061, NASA POWER (MERRA-2 based). Grey")


def test_extra_panels_only_when_files_exist(tmp_path):
    import json
    import shutil

    from pipeline.results_figure import ROOT, make_figure

    for f in (ROOT / "data" / "cache").glob("case_dana_valencia_*.json"):
        shutil.copy(f, tmp_path)
    assert [ax.get_title() for ax in make_figure(collect(tmp_path)).axes] == ["Temperature", "Precipitation"]
    ndvi = json.loads((tmp_path / "case_dana_valencia_T2M.json").read_text(encoding="utf-8"))
    ndvi.update(variable="NDVI", units="NDVI (0-1)", dataset="NASA MOD13A3 v061")
    (tmp_path / "case_dana_valencia_NDVI.json").write_text(json.dumps(ndvi), encoding="utf-8")
    titles = [ax.get_title() for ax in make_figure(collect(tmp_path)).axes]
    assert titles == ["Temperature", "Precipitation", "Vegetation (NDVI)"]
