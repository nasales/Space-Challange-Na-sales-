# Statistics: what data you will get

Nov 14, 2026 · @Perry

## Summary

Spain is split into **about 1180 land cells of 0.25°** (about 28 km per side): about 1170 in the Peninsula and the Balearic Islands and about 10 in the Canary Islands. There are no sea cells. The exact number is set by the GLDAS land mask. The area also includes Portugal, Andorra, southern France and northern Morocco and Algeria. For each cell and each of the **6 variables** you will have the **full monthly series** and a **precomputed trend**.

Everything will be in Supabase, in the `series` and `trends` tables, and also exported to JSON. It is still **pending download**: the actual numbers will arrive when the database teammate runs the script.

## Variables

| id | Variable | Unit | NASA source | Since | Original resolution | Data type |
| --- | --- | --- | --- | --- | --- | --- |
| `tair` | Air temperature (near the surface) | °C | GLDAS-2.1 Noah | 2000 | 0.25° | Land surface model forced with observations |
| `wind` | Wind speed (near the surface) | m/s | GLDAS-2.1 Noah | 2000 | 0.25° | Land surface model |
| `soilmoist` | Soil moisture, 0–10 cm | kg/m² (= mm of water) | GLDAS-2.1 Noah | 2000 | 0.25° | Land surface model |
| `evap` | Evapotranspiration | mm/day | GLDAS-2.1 Noah | 2000 | 0.25° | Land surface model |
| `precip` | Precipitation | mm/day | GPM IMERG Final V07 | 1998 | 0.1°, interpolated to 0.25° | Satellites calibrated with rain gauges |
| `t2m_long` | 2 m temperature (long series) | °C | MERRA-2 | 1980 | 0.5° × 0.625° (\~55 km) | Reanalysis |

All variables are **monthly means**. All 6 variables have data in the same land cells. MERRA-2 is coarse: 4 or 5 neighbouring cells will have the same value. Its advantage is that it starts in 1980. On the coast, its nearest point may fall in the sea.

## What each cell contains

Each cell and variable has one row in `series` (the data) and another in `trends` (the result).

| Field | Table | What it is |
| --- | --- | --- |
| `start_month` | series | First month of the series |
| `values` | series | One value per month, in order; `null` = no data |
| `climatology` | series | 12 means from January to December (the seasonal cycle) |
| `period_start`, `period_end`, `n_months` | trends | Period analysed and number of valid months |
| `mean_value` | trends | Mean of the whole series |
| `slope_per_decade` | trends | Rate of change (Sen's slope), in units per decade |
| `slope_ci_low`, `slope_ci_high` | trends | 95 % confidence interval of the slope |
| `mk_tau`, `p_value` | trends | Mann-Kendall statistic and p-value |
| `significant` | trends | `true` if p < 0.05 |
| `direction` | trends | `increasing`, `decreasing` or `no trend` |

The anomaly of a month is its value minus the climatology of that month. It is computed on the fly and not stored.

## How the trend fields are computed

The trend is computed on **anomalies**, so that the seasonal cycle does not contaminate it. At least 120 valid months are required.

1. **Rate of change:** Sen's slope (median of the slopes between all pairs of months), over real time.
2. **Significance:** Mann-Kendall with pre-whitening (Yue and Wang, 2002), which corrects for the autocorrelation of monthly series.
3. **95 % CI of the slope:** Gilbert's method (1987), with the variance inflated by (1+ρ)/(1−ρ), where ρ is the lag-1 autocorrelation of the residuals.
