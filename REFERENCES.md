# References

## NASA data
| Dataset | Version | Link | Used for |
|---|---|---|---|
| NASA GIBS — Blue Marble Next Generation | `BlueMarble_NextGeneration` layer (WMS, EPSG:4326, "best") | https://gibs.earthdata.nasa.gov | Satellite colour of the explored country on the 3D map (`scripts/fetch-map-data.mjs`) |

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
| pymannkendall | MIT | https://github.com/mmhs013/pyMannKendall | Mann-Kendall trend test (`pipeline/`) |
| SciPy | BSD-3-Clause | https://scipy.org | Statistics (`pipeline/`) |
| pandas | BSD-3-Clause | https://pandas.pydata.org | Time series handling (`pipeline/`) |
| NumPy | BSD-3-Clause | https://numpy.org | Numerical arrays (`pipeline/`) |
