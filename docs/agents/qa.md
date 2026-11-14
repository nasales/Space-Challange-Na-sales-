# QA checklist — run by every person on their own changes

Before opening a pull request, the author (or their agent) runs this checklist on their own branch.
There is no separate QA owner: whoever made the change is responsible for testing it.

## Before every pull request
1. On your branch, run `./scripts/check.sh --e2e`.
2. Review your own diff for:
   - files edited outside your area;
   - any change to `tests/stats/` or `docs/contract.md` (not allowed unless it was approved);
   - Spanish text, NASA logos/branding, secrets or API keys in code;
   - missing lines in `AI_USAGE.md` / `REFERENCES.md`.
3. If your change touches the AI checker, run its test bank (`tests/ai_bank/`): correct, wrong, ambiguous and nonsense conclusions. The verdicts must make sense and must use the statistical result.
4. Write the report and paste it into the pull request:

```
QA REPORT — PR #<n> — <branch>
check.sh --e2e: PASS / FAIL
Review: OK / issues: <list>
AI bank: <n>/<total> sensible verdicts (or "not affected")
Verdict: ✅ READY TO MERGE / ❌ BLOCKED (<reasons>)
Bug lines: <CRITICAL|MEDIUM|MINOR lines>
```

Only open the pull request when the verdict is ✅.

## After every merge into `main`
Person 4 (who merges) runs `./scripts/check.sh --e2e` on `main` and runs the demo path once end to end. If it fails, file a CRITICAL bug immediately.

## After the freeze (Sunday 13:00)
Only open pull requests for CRITICAL fixes.
