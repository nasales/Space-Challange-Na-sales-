# Methods and results

## Statistical method
Every series is a monthly time series. The trend test is the same in the game, in our Python
pipeline (`pipeline/trend.py`) and in the database script (`archivos_preSupabase/etl_espana.py`).

1. **Monthly anomalies.** Each value minus the mean of its calendar month, so the seasonal cycle does not hide or fake a trend.
2. **Rate of change.** Sen slope (median of all pairwise slopes) against real time, reported per year and per decade in the variable's units.
3. **Significance.** Mann-Kendall test with pre-whitening (Yue and Wang, 2002), significance level α = 0.05. Monthly climate data are autocorrelated (one month resembles the next), which makes the classic Mann-Kendall test find trends that are not there. Pre-whitening removes the lag-1 autocorrelation first. In our synthetic tests (200 series each, no trend), the false-positive rate was **0.03 for white noise and 0.04 for AR(1) noise with φ = 0.6**, at or below the nominal 0.05.
4. **95 % confidence interval of the slope.** Gilbert (1987) rank method, with the variance of the Mann-Kendall statistic inflated by (1 + ρ)/(1 − ρ), where ρ is the lag-1 autocorrelation of the residuals.
5. **Minimum data.** At least 120 valid months (10 years); gaps are allowed and ignored.

**A non-significant trend is a valid result.** It means the data show no clear evidence of change, not proof that nothing changed. The game never forces a conclusion.

## Validation
- **Synthetic tests** (`pipeline/tests/test_trend.py`, fixed random seeds): known positive and negative trends are recovered within tolerance, seasonal series without a trend are not significant, false-positive rates on white noise and AR(1) noise stay under limits, and 10 % random gaps do not change the result.
- **Full-scale dry run** (Diego, `python -m pipeline.dry_run`, seed 2026): the whole trend pipeline on 7104 synthetic series (1184 cells × 6 variables, real series lengths, seasonal cycle, AR(1) noise, gaps, half of them without a trend). False-positive rate 4.7-5.6 %; for precipitation 6.8 %, slightly above the nominal 5 %, likely because of its skewed distribution. 95 % CI coverage 93.9-95.8 %. Slope bias within ±3 %. Strong trends were always detected. The Gilbert CI is asymmetric by design: it is rank-based, and its two ranks are rounded outwards.
- **Exact match with the database script.** `analyze_trend` and `trend_stats()` give the same slope, p-value, Tau, significance and confidence interval (relative tolerance 1e-9, `pipeline/tests/test_trend_matches_db.py`). `pipeline/compare_db.py` repeats this check on the real database export.
- **Cross tests between team members** (`tests/stats/`): one statistics owner tests the other's code, for example that a case built from a trend result passes the data contract validator.
- **Data contract check** (`./scripts/check.sh`): every file in `data/cache/`, including the 19 featured series, is validated against `docs/contract.md`.

## Test and confidence interval near p = 0.05
Significance comes from the pre-whitened Mann-Kendall test (Yue and Wang 2002), and the 95 % CI of the slope from Gilbert's rank method with the variance inflated for lag-1 autocorrelation. They are computed differently, so near p = 0.05 the CI can touch zero while the test is significant. This happens in three soil-moisture series: Doñana (p = 0.050), Sierra de la Culebra (p = 0.026) and Tablas de Daimiel (p = 0.047). We report them as significant but as weak evidence, and the facts for the AI checker say so ("Evidence is weak: the p-value is close to the 0.05 threshold.").

## NASA data
- **Featured cases (10 places, 19 series):** monthly values of the native pixel that contains each case point, prepared by Perry (`case_series` export) and built with `python -m pipeline.build_cases --source case_export`:
  - `T2M`: MERRA-2 `M2TMNXSLV` 5.12.4, 2 m air temperature, 1980-01 to 2026-09;
  - `PRECIP`: GPM IMERG Final `GPM_3IMERGM` V07, precipitation, 1998-01 to 2025-09;
  - `SOILM`: GLDAS-2.1 Noah `GLDAS_NOAH025_M`, soil moisture 0-10 cm, 2000-01 to 2026-07.
- **Fallback (documented, not used in the current files):** NASA POWER monthly point data, community AG (`T2M`, `PRECTOTCORR`, `GWETTOP`), 1981-2024, based on MERRA-2 (`python -m pipeline.build_cases --source power`, raw files in `data/raw/power/`). Data obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program, https://power.larc.nasa.gov/.
- **Map (any point in Spain):**
  - GLDAS Noah Land Surface Model L4 monthly 0.25° (`GLDAS_NOAH025_M`) v2.1, https://doi.org/10.5067/SXAVCZFAQLNO;
  - GPM IMERG Final Precipitation L3 monthly (`GPM_3IMERGM`) V07, https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07;
  - MERRA-2 tavgM_2d_slv_Nx monthly (`M2TMNXSLV`) 5.12.4, https://doi.org/10.5067/AP1B0BA5PD2K.

Units: `T2M` 2 m air temperature (°C), `PRECIP` precipitation (mm/day), `SOILM` soil moisture in the top 10 cm (kg/m², 1 kg/m² = 1 mm of water). With the POWER fallback: `PRECTOTCORR` (mm/day), `GWETTOP` surface soil wetness (fraction 0-1).

## Cross-dataset check
<!-- CROSS_START (generated by python -m pipeline.cross_check --write) -->
Each featured series (Perry's native-pixel MERRA-2 / GPM IMERG / GLDAS data) is compared with NASA POWER at the same point, both cut to their common period and analysed with the same `analyze_trend`. Soil moisture is compared by direction only, because GLDAS 0-10 cm soil moisture (kg/m²) and POWER `GWETTOP` (surface wetness, 0-1) are different quantities. Direction agrees in 14 of 18 series; significance agrees in 13 of 13 temperature and precipitation series. POWER temperature is itself based on MERRA-2, so the T2M agreement (slope ratio close to 1) is a consistency check, not an independent confirmation; precipitation and soil moisture come from different products and are the informative comparisons. Not compared (no POWER file): Storm Filomena PRECIP.

| Case | Variable (case / POWER) | Common period | Direction (case / POWER) | Significant (case / POWER) | Slope ratio case / POWER | Agree |
|---|---|---|---|---|---|---|
| Valencia DANA | T2M / T2M | 1981-01 to 2024-12 | up / up | yes / yes | 1.00 | direction + significance |
| Valencia DANA | PRECIP / PRECTOTCORR | 1998-01 to 2024-12 | up / up | no / no | 0.08 | direction + significance |
| Doñana wetlands | PRECIP / PRECTOTCORR | 1998-01 to 2024-12 | down / down | no / no | 2.93 | direction + significance |
| Doñana wetlands | SOILM / GWETTOP | 2000-01 to 2024-12 | down / down | no / no | n/a (different quantity) | direction |
| Sierra de la Culebra fire | T2M / T2M | 1981-01 to 2024-12 | up / up | yes / yes | 1.00 | direction + significance |
| Sierra de la Culebra fire | SOILM / GWETTOP | 2000-01 to 2024-12 | down / up | yes / no | n/a (different quantity) | no |
| Galicia fires | T2M / T2M | 1981-01 to 2024-12 | up / up | yes / yes | 1.01 | direction + significance |
| Galicia fires | SOILM / GWETTOP | 2000-01 to 2024-12 | down / down | no / no | n/a (different quantity) | direction |
| Ebro Delta | T2M / T2M | 1981-01 to 2024-12 | up / up | yes / yes | 1.00 | direction + significance |
| Ebro Delta | PRECIP / PRECTOTCORR | 1998-01 to 2024-12 | down / down | no / no | 0.05 | direction + significance |
| Storm Filomena | T2M / T2M | 1981-01 to 2024-12 | up / up | yes / yes | 1.00 | direction + significance |
| Almería-Murcia drylands | PRECIP / PRECTOTCORR | 1998-01 to 2024-12 | down / up | no / no | -1.29 | significance only |
| Almería-Murcia drylands | SOILM / GWETTOP | 2000-01 to 2024-12 | down / up | no / no | n/a (different quantity) | no |
| Córdoba heat | T2M / T2M | 1981-01 to 2024-12 | up / up | yes / yes | 1.00 | direction + significance |
| Aneto glacier | T2M / T2M | 1981-01 to 2024-12 | up / up | yes / yes | 1.00 | direction + significance |
| Aneto glacier | PRECIP / PRECTOTCORR | 1998-01 to 2024-12 | up / up | no / no | 0.38 | direction + significance |
| Tablas de Daimiel | PRECIP / PRECTOTCORR | 1998-01 to 2024-12 | down / up | no / no | -1.13 | significance only |
| Tablas de Daimiel | SOILM / GWETTOP | 2000-01 to 2024-12 | down / down | yes / no | n/a (different quantity) | direction |
<!-- CROSS_END -->

## Results of the featured cases
<!-- RESULTS_START (generated by python -m pipeline.results_table --write) -->
| Case | Variable | Slope per decade | 95% CI per decade | p | Significant |
|---|---|---|---|---|---|
| Valencia DANA | PRECIP | +0.0227 mm/day | -0.139 to +0.177 | 0.672 | no |
| Valencia DANA | T2M | +0.312 °C | +0.217 to +0.409 | < 0.001 | yes |
| Doñana wetlands | SOILM | -0.288 kg/m² (0-10 cm) | -0.585 to +0.00173 | 0.050 | yes |
| Doñana wetlands | PRECIP | -0.0537 mm/day | -0.245 to +0.0793 | 0.440 | no |
| Sierra de la Culebra fire | T2M | +0.262 °C | +0.148 to +0.37 | < 0.001 | yes |
| Sierra de la Culebra fire | SOILM | -0.53 kg/m² (0-10 cm) | -1.07 to +0.0106 | 0.026 | yes |
| Galicia fires | T2M | +0.258 °C | +0.152 to +0.367 | < 0.001 | yes |
| Galicia fires | SOILM | -0.439 kg/m² (0-10 cm) | -1.05 to +0.147 | 0.112 | no |
| Ebro Delta | PRECIP | +0 mm/day | -0.131 to +0.132 | 0.897 | no |
| Ebro Delta | T2M | +0.345 °C | +0.259 to +0.431 | < 0.001 | yes |
| Storm Filomena | T2M | +0.374 °C | +0.256 to +0.49 | < 0.001 | yes |
| Storm Filomena | PRECIP | +0.0229 mm/day | -0.12 to +0.175 | 0.789 | no |
| Almería-Murcia drylands | PRECIP | -0.0466 mm/day | -0.146 to +0.0468 | 0.233 | no |
| Almería-Murcia drylands | SOILM | -0.361 kg/m² (0-10 cm) | -0.935 to +0.193 | 0.150 | no |
| Córdoba heat | T2M | +0.333 °C | +0.22 to +0.446 | < 0.001 | yes |
| Aneto glacier | T2M | +0.394 °C | +0.265 to +0.519 | < 0.001 | yes |
| Aneto glacier | PRECIP | +0.037 mm/day | -0.144 to +0.218 | 0.717 | no |
| Tablas de Daimiel | SOILM | -0.487 kg/m² (0-10 cm) | -1.05 to +0.082 | 0.047 | yes |
| Tablas de Daimiel | PRECIP | -0.00888 mm/day | -0.127 to +0.107 | 0.828 | no |
<!-- RESULTS_END -->

Temperature rises significantly at all 7 places where it was tested (about +0.2 to +0.3 °C per decade). Precipitation and soil wetness show no significant trend, except a small increase in precipitation at Aneto.

References: Yue, S. and Wang, C. (2002), *Water Resources Research* 38(6), 1068, https://doi.org/10.1029/2001WR000861. Gilbert, R. O. (1987), *Statistical Methods for Environmental Pollution Monitoring*, Van Nostrand Reinhold.
