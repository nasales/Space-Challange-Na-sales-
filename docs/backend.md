# Backend (Python + Supabase)

The hosted game is a static site on Cloudflare Workers and reads Supabase directly from the
browser (`src/shared/supabase.ts`, publishable key, read only). The Python API below is a
local development tool: it is not deployed.

```
Browser (Vite + React)  --fetch /api/*-->  api/index.py (FastAPI, local only)
                                              |-- backend/cases.py --> Supabase table `cases`
                                              '-- fallback ---------> data/cache/*.json
pipeline/ (offline Python stats) --writes--> data/cache/*.json --upload--> Supabase
```

## Folders
| Path | What | Who |
|---|---|---|
| `api/index.py` | Local entrypoint (`npm run dev:api`), only imports `backend.app` | Backend |
| `backend/` | FastAPI routes (`app.py`), Supabase client (`db.py`), queries (`cases.py`), contract model (`models.py`) | Backend + database |
| `supabase/schema.sql` | Table definitions, run in the Supabase SQL editor | Database |
| `pipeline/` | Offline statistics, writes `data/cache/` (see `pipeline/README.md`) | Data / statistics |
| `src/shared/api.ts` | Typed `fetch` helpers for the frontend | Interface |
| `tests/api/` | API smoke tests | Backend |

## Endpoints
| Method + path | Returns |
|---|---|
| `GET /api/health` | `{ ok, supabase: "connected" \| "not_configured" \| "error" }` |
| `GET /api/cases` | `[{ id, place, lat, lon, variable }]` |
| `GET /api/cases/{id}` | One case in the `docs/contract.md` format, or 404 |

## Run locally
Needs Node and Python 3.12.
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # optional: fill Supabase URL + service role key

npm run dev:api             # terminal 1: FastAPI on http://127.0.0.1:8000
npm run dev                 # terminal 2: Vite; /api is proxied to port 8000
python -m pytest tests/api -q
```
Without `.env`, everything still works from `data/cache/`.

## Add a database query
1. Add a function in `backend/cases.py` (or a new module in `backend/`) using `get_client()`.
   Always keep a fallback for when `get_client()` returns `None` or the query fails.
2. Expose it with a route in `backend/app.py` under `/api/...`.
3. Add a typed helper in `src/shared/api.ts` and a test in `tests/api/`.
4. New tables go in `supabase/schema.sql`. Changing the case fields changes the contract
   (needs Person 3 + Yeipi approval).

## Deploy
- The site is a static Vite build on Cloudflare Workers, built from `main` on every push:
  build command `npm run build`, output directory `dist`.
- Build variables on Cloudflare: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
  (the publishable key only; a `VITE_` variable always ends up public in the browser).
- The Python API is not deployed: Cloudflare serves static files only, so `/api` does not exist
  on the hosted site.

## Secrets
The service role key bypasses Row Level Security. Keep it in `.env` (gitignored) only.
Never commit it and never prefix it with `VITE_` (that ships it to the browser).
