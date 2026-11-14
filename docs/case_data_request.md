# Data request for the featured case studies (Ivan -> Perry)
All from the challenge resources (Giovanni / AppEEARS). For each case x variable: monthly mean over the box (area average), from the dataset start to 2025-10, nulls for gaps, same shape as the `series` table (start_month, values). Box = lat_min, lat_max, lon_min, lon_max.

## Datasets
- T2M: MERRA-2 M2TMNXSLV v5.12.4, variable T2M (K), 1980-
- PRECIP: GPM IMERG Final monthly GPM_3IMERGM v07, precipitation (mm/hr), 1998-
- SOILM: GLDAS-2.1 Noah GLDAS_NOAH025_M, SoilMoi0_10cm_inst (kg/m2), 2000-
- NDVI: MODIS MOD13A3 v061 (monthly 1 km) via AppEEARS, 2000-
- LST: MODIS MOD11C3 v061 (monthly 0.05 deg), day LST, 2000-
- SNOW: MODIS MOD10CM v061 (monthly snow cover 0.05 deg), 2000-

## Cases
| id | place | box | variables |
|---|---|---|---|
| dana_valencia | Valencia | 39.2, 39.6, -0.7, -0.3 | PRECIP, T2M |
| donana | Doñana | 36.8, 37.2, -6.6, -6.2 | SOILM, PRECIP, NDVI |
| sierra_culebra | Sierra de la Culebra | 41.8, 42.0, -6.5, -6.1 | T2M, SOILM, NDVI |
| galicia_fires | Ourense | 42.1, 42.5, -8.1, -7.7 | T2M, SOILM, NDVI |
| ebro_delta | Ebro Delta | 40.55, 40.85, 0.6, 0.95 | PRECIP, T2M, NDVI |
| filomena_madrid | Madrid | 40.3, 40.55, -3.85, -3.55 | T2M, PRECIP |
| almeria_murcia | Almería-Murcia | 37.0, 37.6, -2.4, -1.4 | PRECIP, SOILM, NDVI |
| cordoba_heat | Córdoba | 37.8, 38.0, -4.9, -4.6 | T2M, LST |
| aneto_glacier | Aneto | 42.55, 42.7, 0.55, 0.75 | T2M, PRECIP, SNOW |
| daimiel | Tablas de Daimiel | 39.1, 39.2, -3.75, -3.65 | SOILM, PRECIP, NDVI |

Priority if time is short: T2M, PRECIP and SOILM first (Giovanni, quick); NDVI, LST and SNOW second (AppEEARS, slower).
Current backup: NASA POWER point data for all cases is already in data/cache/ and works offline; it stays as fallback until these series are in Supabase.
