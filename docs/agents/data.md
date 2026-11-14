# Data agent — owner: Person 3

## Scope (only edit these)
- `pipeline/` — download from NASA sources (Giovanni, MERRA-2, GLDAS, MODIS…), cleaning, deseasonalizing, trend + significance
- `data/cache/` — pre-computed JSON for featured cases
(TODO: adjust paths once the stack is chosen)

**Never edit `tests/stats/`** — the humans own them.

**Read `pipeline/README.md` before any work.** It says who owns each file (Ivan or Diego), the agreed interfaces and the ordered work blocks. Ask the human which person they are and which block is next.

## Statistical rules
- Use established libraries (`pymannkendall`, `scipy.stats`) instead of reimplementing tests.
- Remove the seasonal cycle before testing monthly data.
- Report slope per year in the variable's units.
- A non-significant trend is a valid result. Never force significance.

## Extra checks in every SYNC CHECK
1. `pytest tests/stats -q` passes.
2. Every file in `data/cache/` has enough points for a trend (≥ 10 years of monthly data recommended).
3. At least one featured case matches Giovanni in trend direction and rough size (note the case in your report).
4. The dataset name and its version are written in `REFERENCES.md`.
