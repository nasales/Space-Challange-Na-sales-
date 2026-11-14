# Backend (Vercel + Python + Supabase)

```
Browser (Vite + React)  --fetch /api/*-->  api/index.py (FastAPI, Vercel Python function)
                                              |-- backend/cases.py --> Supabase table `cases`
                                              '-- fallback ---------> data/cache/*.json
pipeline/ (offline Python stats) --writes--> data/cache/*.json --upload--> Supabase
```

## Folders
| Path | What | Who |
|---|---|---|
| `vercel.json` | Vite build + rewrite of `/api/*` to `api/index.py` | Backend |
| `api/index.py` | Vercel entrypoint, only imports `backend.app` | Backend |
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

## Deploy on Vercel
1. Import the GitHub repo in Vercel (framework is detected from `vercel.json`).
2. Project Settings → Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Every push creates a preview; only Person 4 merges to `main` (production).

## Secrets
The service role key bypasses Row Level Security. Keep it in `.env` (gitignored) and in
Vercel settings only. Never commit it and never prefix it with `VITE_` (that ships it to the browser).
