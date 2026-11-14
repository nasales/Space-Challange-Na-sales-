# References

## NASA data
| Dataset | Version | Link | Used for |
|---|---|---|---|
| GLDAS Noah Land Surface Model L4 monthly 0.25° (`GLDAS_NOAH025_M`) | 2.1 | https://doi.org/10.5067/SXAVCZFAQLNO | `tair`, `wind`, `soilmoist`, `evap` and the land mask (Supabase `series`) |
| GPM IMERG Final Precipitation L3 monthly 0.1° (`GPM_3IMERGM`) | V07 | https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07 | `precip` (Supabase `series`) |
| MERRA-2 tavgM_2d_slv_Nx monthly (`M2TMNXSLV`) | 5.12.4 | https://doi.org/10.5067/AP1B0BA5PD2K | `t2m_long` (Supabase `series`) |

## Other data, code, libraries, models, fonts and images
| Name | License | Link | Used for |
|---|---|---|---|
| Yue, S. and Wang, C. (2002). Applicability of prewhitening to eliminate the influence of serial correlation on the Mann-Kendall test. Water Resources Research 38(6), 1068 | Scientific paper (method cited) | https://doi.org/10.1029/2001WR000861 | Pre-whitened Mann-Kendall test in `pipeline/trend.py` |
| Gilbert, R. O. (1987). Statistical Methods for Environmental Pollution Monitoring. Van Nostrand Reinhold | Book (method cited) | ISBN 978-0-442-23050-0 | Confidence interval of the Sen slope in `pipeline/trend.py` |
| pymannkendall 1.4.3 | MIT | https://github.com/mmhs013/pyMannKendall | Mann-Kendall test in `pipeline/trend.py` |
| SciPy 1.18.1 | BSD-3-Clause | https://scipy.org | Sen slope (`theilslopes`) and normal quantile in `pipeline/trend.py` |
| NumPy 2.5.4 | BSD-3-Clause | https://numpy.org | Array maths in `pipeline/` |
| pytest 9.2.0 | MIT | https://pytest.org | Tests in `pipeline/tests/` |
| earthaccess 0.19.0 | MIT | https://github.com/nsidc/earthaccess | NASA Earthdata search and streaming in `archivos_preSupabase/etl_espana.py` |
| xarray 2026.9.0 | Apache-2.0 | https://xarray.dev | Gridded data handling in the ETL |
| h5netcdf / h5py | BSD-3-Clause | https://github.com/h5netcdf/h5netcdf | Reading NetCDF4/HDF5 files in the ETL |
| psycopg 3.3.9 | LGPL-3.0 | https://www.psycopg.org | Uploading to Supabase (Postgres) in the ETL |
| Supabase | Apache-2.0 (platform, hosted free plan) | https://supabase.com | Database for series and trends |
