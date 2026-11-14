# References

## NASA data
| Dataset | Version | Link | Used for |
|---|---|---|---|
| NASA GIBS — Blue Marble Next Generation | `BlueMarble_NextGeneration` layer (WMS, EPSG:4326, "best") | https://gibs.earthdata.nasa.gov | Satellite colour of the explored country on the 3D map (`scripts/fetch-map-data.mjs`) |
| GLDAS Noah Land Surface Model L4 monthly 0.25° (`GLDAS_NOAH025_M`) | 2.1 | https://doi.org/10.5067/SXAVCZFAQLNO | `tair`, `wind`, `soilmoist`, `evap` and the land mask (Supabase `series`) |
| GPM IMERG Final Precipitation L3 monthly 0.1° (`GPM_3IMERGM`) | V07 | https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07 | `precip` (Supabase `series`) |
| MERRA-2 tavgM_2d_slv_Nx monthly (`M2TMNXSLV`) | 5.12.4 | https://doi.org/10.5067/AP1B0BA5PD2K | `t2m_long` (Supabase `series`) |
| NASA POWER (Prediction Of Worldwide Energy Resources) monthly point data, community AG: `T2M`, `PRECTOTCORR`, `GWETTOP`, 1981-2024. Data obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program. Source: MERRA-2 | API v2.10.0 | https://power.larc.nasa.gov/ | Featured case studies (`data/raw/power/`, `data/cache/case_*.json`) |

## Other data, code, libraries, models, fonts and images
| Name | License | Link | Used for |
|---|---|---|---|
| three.js | MIT | https://threejs.org | 3D world map and game rendering |
| Playwright | Apache-2.0 | https://playwright.dev | End-to-end tests of the demo path (dev only) |
| AWS Terrain Tiles (Terrarium format; SRTM and other sources) | Open data, attribution required — see https://github.com/tilezen/joerd/blob/master/docs/attribution.md | https://registry.opendata.aws/terrain-tiles/ | Elevation of the 3D map (`scripts/fetch-map-data.mjs`, `scripts/fetch-world-data.mjs`) |
| Natural Earth — Admin 0 Countries 1:50m | Public domain | https://www.naturalearthdata.com | Country borders of the world map (`scripts/fetch-world-data.mjs`) |
| Natural Earth — Rivers and lake centerlines 1:10m (incl. Europe supplement) | Public domain | https://www.naturalearthdata.com (via github.com/nvkelso/natural-earth-vector) | River lines of Spain (`scripts/fetch-rivers.mjs` → `public/maps/countries/ESP/rivers.json`) |
| GeoNames | CC BY 4.0 | https://www.geonames.org | Town names, regions and positions (`public/maps/countries/ESP/places.json`) |
| FastAPI | MIT | https://fastapi.tiangolo.com | Python API served as a Vercel Function (`backend/`) |
| supabase-py | MIT | https://github.com/supabase/supabase-py | Database queries from the backend (`backend/db.py`) |
| Uvicorn | BSD-3-Clause | https://www.uvicorn.org | Local development server for the API (dev only) |
| pandas | BSD-3-Clause | https://pandas.pydata.org | Time series handling (`pipeline/`) |
| Yue, S. and Wang, C. (2002). Applicability of prewhitening to eliminate the influence of serial correlation on the Mann-Kendall test. Water Resources Research 38(6), 1068 | Scientific paper (method cited) | https://doi.org/10.1029/2001WR000861 | Pre-whitened Mann-Kendall test in `pipeline/trend.py` |
| Gilbert, R. O. (1987). Statistical Methods for Environmental Pollution Monitoring. Van Nostrand Reinhold | Book (method cited) | ISBN 978-0-442-23050-0 | Confidence interval of the Sen slope in `pipeline/trend.py` |
| Mann, H. B. (1945). Nonparametric tests against trend. Econometrica 13(3), 245-259 | Scientific paper (method cited) | https://doi.org/10.2307/1907187 | Mann-Kendall trend test (`docs/methods.md`) |
| Kendall, M. G. (1975). Rank Correlation Methods, 4th ed. Charles Griffin, London | Book (method cited) | — | Mann-Kendall trend test (`docs/methods.md`) |
| Theil, H. (1950). A rank-invariant method of linear and polynomial regression analysis, I-III. Proc. Koninklijke Nederlandse Akademie van Wetenschappen 53 | Scientific paper (method cited) | — | Sen (Theil-Sen) slope (`docs/methods.md`) |
| Sen, P. K. (1968). Estimates of the regression coefficient based on Kendall's tau. JASA 63(324), 1379-1389 | Scientific paper (method cited) | https://doi.org/10.1080/01621459.1968.10480934 | Sen slope (`docs/methods.md`) |
| Benjamini, Y. and Hochberg, Y. (1995). Controlling the false discovery rate. J. R. Stat. Soc. B 57(1), 289-300 | Scientific paper (cited in limitations) | https://doi.org/10.1111/j.2517-6161.1995.tb02031.x | Multiple testing limitation (`docs/methods.md`) |
| Wilks, D. S. (2016). "The stippling shows statistically significant grid points". BAMS 97(12), 2263-2273 | Scientific paper (cited in limitations) | https://doi.org/10.1175/BAMS-D-15-00267.1 | Multiple testing limitation (`docs/methods.md`) |
| Rodell, M. et al. (2004). The Global Land Data Assimilation System. BAMS 85(3), 381-394 | Scientific paper (dataset description) | https://doi.org/10.1175/BAMS-85-3-381 | GLDAS reference (`docs/methods.md`) |
| Huffman, G. J. et al. (2023). GPM IMERG Final Precipitation L3 1 month 0.1° V07. GES DISC | Dataset citation | https://doi.org/10.5067/GPM/IMERG/3B-MONTH/07 | IMERG reference (`docs/methods.md`) |
| Gelaro, R. et al. (2017). The Modern-Era Retrospective Analysis for Research and Applications, Version 2 (MERRA-2). J. Climate 30(14), 5419-5454 | Scientific paper (dataset description) | https://doi.org/10.1175/JCLI-D-16-0758.1 | MERRA-2 reference (`docs/methods.md`) |
| pymannkendall 1.4.3 | MIT | https://github.com/mmhs013/pyMannKendall | Mann-Kendall test in `pipeline/trend.py` |
| SciPy 1.18.1 | BSD-3-Clause | https://scipy.org | Sen slope (`theilslopes`) and normal quantile in `pipeline/trend.py` |
| NumPy 2.5.4 | BSD-3-Clause | https://numpy.org | Array maths in `pipeline/` |
| pytest 9.2.0 | MIT | https://pytest.org | Tests in `pipeline/tests/` |
| earthaccess 0.19.0 | MIT | https://github.com/nsidc/earthaccess | NASA Earthdata search and streaming in `archivos_preSupabase/etl_espana.py` |
| xarray 2026.9.0 | Apache-2.0 | https://xarray.dev | Gridded data handling in the ETL |
| h5netcdf / h5py | BSD-3-Clause | https://github.com/h5netcdf/h5netcdf | Reading NetCDF4/HDF5 files in the ETL |
| psycopg 3.3.9 | LGPL-3.0 | https://www.psycopg.org | Uploading to Supabase (Postgres) in the ETL |
| Supabase | Apache-2.0 (platform, hosted free plan) | https://supabase.com | Database for series and trends |
