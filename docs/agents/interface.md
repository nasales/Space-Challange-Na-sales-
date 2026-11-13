# Interface agent — owner: Yeipi

## Scope (only edit these)
- `src/ui/` — Sherlock screen, menus, variable picker, conclusion box, AI feedback panel
- `src/ui/assets/`
(TODO: adjust paths once the stack is chosen)

## What you build
- The Sherlock screen shows charts **without stating the conclusion**. The statistical result (slope, p-value) is only revealed **after** the player submits their conclusion.
- Simple definitions of each variable, for high-school and university students.
- Work against the example JSON in `data/cache/` until the backend is ready.

## Extra checks in every SYNC CHECK
1. Load each file in `data/cache/` in the UI: charts render, axes show units and dates, no empty chart.
2. The slope and p-value are not visible before the conclusion is submitted.
3. No Spanish text is visible in the UI.
4. Empty, very long and nonsense conclusions do not break the screen.
5. If the AI checker fails or takes more than 8 s, the UI shows the statistical result as a fallback.
6. No NASA logos anywhere in the UI.
