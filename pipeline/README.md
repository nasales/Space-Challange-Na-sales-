# Statistics pipeline (Data area, Person 3)

Offline Python code that turns NASA data into featured cases. It runs on your machine,
**not** on Vercel, so heavy libraries (pandas, scipy…) are fine here.

## Setup
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r pipeline/requirements.txt
```

## Workflow
1. **Download** the series (Giovanni, MERRA-2, GLDAS, MODIS…) and keep the raw files out of git.
2. **Clean + deseasonalize** monthly data.
3. **Trend + significance**: implement `compute_trend()` in `pipeline/trend.py`
   (pymannkendall / scipy.stats — never reimplement the tests, never force significance).
4. **Write one JSON per case** to `data/cache/<case_id>.json`, following `docs/contract.md`.
   The file name is the case id used by `/api/cases/<case_id>`.
5. **Validate**: `python scripts/validate_contract.py data/cache/*.json` (also run by `./scripts/check.sh`).
6. **Optional upload to Supabase**: fill `.env` (see `.env.example`) and run
   `python -m pipeline.upload_cases` from the repo root.

The game works offline from `data/cache/` even if Supabase is down (AGENTS.md rule 10).
