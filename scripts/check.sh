#!/usr/bin/env bash
# Team check script. Usage: ./scripts/check.sh [--e2e]
# Runs whatever applies to the current stack; missing pieces are skipped, not failed.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

E2E=0; [ "${1:-}" = "--e2e" ] && E2E=1
FAIL=0
pass() { echo "  [PASS] $1"; }
fail() { echo "  [FAIL] $1"; FAIL=1; }
warn() { echo "  [WARN] $1"; }
skip() { echo "  [SKIP] $1"; }

echo "== Team check =="

# Python interpreter: python3 if it really runs (on Windows it can be the Microsoft Store alias), else python.
if python3 -c "" >/dev/null 2>&1; then PY=python3; else PY=python; fi

# 1. Data contract
if ls data/cache/*.json >/dev/null 2>&1; then
  if $PY scripts/validate_contract.py data/cache/*.json; then pass "data contract"; else fail "data contract"; fi
else skip "data contract (no data/cache/*.json yet)"; fi

# 2. Statistics tests (human-owned)
if [ -d tests/stats ]; then
  if $PY -m pytest tests/stats -q; then pass "stats tests"; else fail "stats tests"; fi
else skip "stats tests (no tests/stats yet)"; fi

# 3. Other Python tests
if [ -d tests ] && ls tests/*.py >/dev/null 2>&1; then
  if $PY -m pytest tests -q --ignore=tests/stats; then pass "python tests"; else fail "python tests"; fi
fi

# 4. JS/TS frontend: tests + build
if [ -f package.json ]; then
  if npm test --if-present --silent; then pass "npm test"; else fail "npm test"; fi
  if npm run build --if-present --silent >/dev/null; then pass "build"; else fail "build"; fi
else skip "frontend (no package.json yet)"; fi

# 5. Main-path end-to-end test (slow, only with --e2e)
if [ $E2E -eq 1 ]; then
  if ls playwright.config.* >/dev/null 2>&1; then
    if npx playwright test; then pass "e2e demo path"; else fail "e2e demo path"; fi
  else skip "e2e (no playwright config yet)"; fi
fi

# 6. Spanish characters in source (warning only)
if [ -d src ]; then
  HITS=$(grep -rnE "[áéíóúñ¿¡]" src 2>/dev/null | grep -vE "node_modules|\.min\." | head -5)
  [ -n "$HITS" ] && warn "possible Spanish text in src/:
$HITS" || pass "no Spanish characters in src/"
fi

# 7. NASA logo files (warning only)
LOGOS=$(find . -path ./node_modules -prune -o -type f \( -iname "*nasa*logo*" -o -iname "*meatball*" -o -iname "*nasa*worm*" \) -print 2>/dev/null | head -5)
[ -n "$LOGOS" ] && warn "possible NASA logo files:
$LOGOS" || pass "no NASA logo files"

# 8. Required docs
for f in AI_USAGE.md REFERENCES.md; do [ -f "$f" ] && pass "$f exists" || fail "$f missing"; done

echo
if [ $FAIL -eq 0 ]; then echo "RESULT: PASS"; else echo "RESULT: FAIL"; fi
exit $FAIL
