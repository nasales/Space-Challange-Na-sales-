"""Tests for pipeline.explain.explain (block 4 of pipeline/README.md)."""

from dataclasses import dataclass

from pipeline.explain import CAVEAT, explain


@dataclass
class FakeSeries:
    place: str = "Salamanca"
    variable: str = "tair"
    units: str = "°C"
    dataset: str = "GLDAS-2.1 Noah"
    lat: float = 40.875
    lon: float = -5.625


def _trend(**overrides):
    base = {
        "slope": 0.026050505878636696,
        "p_value": 1.868545318473025e-10,
        "significant": True,
        "test": "mann-kendall-prewhitening-yue-wang-2002",
        "slope_ci_low": 0.020207326711881413,
        "slope_ci_high": 0.032025328691112444,
        "mk_tau": 0.2768,
        "n_points": 240,
        "start": "2000-01",
        "end": "2019-12",
        "total_change": 0.5188392420828495,
        "direction": "increasing",
        "warnings": [],
    }
    base.update(overrides)
    return base


def test_significant_increasing():
    text = explain(_trend(), FakeSeries())
    assert text.splitlines() == [
        "Place: Salamanca (40.875, -5.625)",
        "Variable: tair (°C). Data: NASA GLDAS-2.1 Noah",
        "Period: 2000-01 to 2019-12, 240 valid months",
        "Trend: 0.0261 °C/year (0.261 °C/decade), 95% CI 0.0202 to 0.032 °C/year",
        "Total change over the period: 0.519 °C",
        "Mann-Kendall p-value: p < 0.001, significant at the 5% level",
        "Direction: increasing",
    ]
    assert CAVEAT not in text


def test_significant_decreasing():
    text = explain(_trend(slope=-0.0512, slope_ci_low=-0.06, slope_ci_high=-0.04,
                          total_change=-1.02, p_value=0.0034, direction="decreasing"), FakeSeries())
    assert "Trend: -0.0512 °C/year (-0.512 °C/decade)" in text
    assert "Mann-Kendall p-value: p = 0.0034, significant at the 5% level" in text
    assert "Direction: decreasing" in text
    assert CAVEAT not in text


def test_not_significant_has_caveat():
    text = explain(_trend(slope=0.004, p_value=0.4123, significant=False, direction="no trend"), FakeSeries())
    assert "Mann-Kendall p-value: p = 0.412, not significant at the 5% level" in text
    assert "Direction: no statistically significant trend" in text
    assert text.splitlines()[-1] == CAVEAT


def test_warnings_one_line_each():
    text = explain(_trend(warnings=["many gaps", "long gap"]), FakeSeries())
    assert "Warning: many gaps\nWarning: long gap" in text


def test_only_contract_keys():
    trend = {"slope": 0.03, "p_value": 0.2, "significant": False, "test": "mann-kendall"}
    text = explain(trend, object())  # series without any attribute
    assert text.splitlines() == [
        "Trend: 0.03/year (0.3/decade)",
        "Mann-Kendall p-value: p = 0.2, not significant at the 5% level",
        "Direction: no statistically significant trend",
        CAVEAT,
    ]


def test_p_value_formatting():
    assert "p < 0.001" in explain(_trend(p_value=0.000999), FakeSeries())
    assert "p = 0.001," in explain(_trend(p_value=0.001), FakeSeries())
    assert "p = 0.0457," in explain(_trend(p_value=0.045678), FakeSeries())


def test_deterministic():
    assert explain(_trend(), FakeSeries()) == explain(_trend(), FakeSeries())


def test_dataset_credit_does_not_repeat_nasa():
    text = explain(_trend(), FakeSeries(dataset="NASA POWER (MERRA-2 based) T2M"))
    assert "Data: NASA POWER (MERRA-2 based) T2M" in text
    assert "NASA NASA" not in text
