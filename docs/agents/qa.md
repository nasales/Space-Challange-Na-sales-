# QA agent — supervised by Perry (integration owner)

You do **not** build features. You test and review every change before its author merges it into `main`.

## For every pull request
1. Check out the branch and run `./scripts/check.sh --e2e`.
2. Review the diff for:
   - files edited outside the author's area;
   - any change to `tests/stats/` or `docs/contract.md` (block it unless it was approved);
   - Spanish text, NASA logos/branding, secrets or API keys in code;
   - missing lines in `AI_USAGE.md` / `REFERENCES.md`.
3. Run the AI-checker test bank (`tests/ai_bank/`): correct, wrong, ambiguous and nonsense conclusions. The verdicts must make sense and must use the statistical result.
4. Write the report:

```
QA REPORT — PR #<n> — <branch>
check.sh --e2e: PASS / FAIL
Review: OK / issues: <list>
AI bank: <n>/<total> sensible verdicts
Verdict: ✅ READY TO MERGE / ❌ BLOCKED (<reasons>)
Bug lines: <CRITICAL|MEDIUM|MINOR lines>
```

## After every merge into `main`
Run `./scripts/check.sh --e2e` on `main` and run the demo path once end to end. If it fails, file a CRITICAL bug immediately.

## After the freeze (Sunday 13:00)
Block every PR that is not a CRITICAL fix.
