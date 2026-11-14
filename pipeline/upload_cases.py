"""Upload every data/cache/*.json case to the Supabase `cases` table.

Usage (from the repo root, with .env filled in):
    python -m pipeline.upload_cases

The id of each row is the file name without .json. Validate first with
`python scripts/validate_contract.py data/cache/*.json`.
"""
import sys

from backend.cases import TABLE, _read_cache
from backend.db import get_client


def main() -> int:
    client = get_client()
    if client is None:
        print("Supabase is not configured: fill SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")
        return 1
    rows = [{"id": case_id, **data} for case_id, data in _read_cache().items()]
    if not rows:
        print("No data/cache/*.json files to upload")
        return 0
    client.table(TABLE).upsert(rows).execute()
    print(f"Uploaded {len(rows)} case(s) to '{TABLE}'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
