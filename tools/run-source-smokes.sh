#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
MANIFEST="$ROOT/tools/source-smoke-tests.txt"
fail(){ printf 'SOURCE SMOKE FAIL: %s\n' "$*" >&2; exit 1; }
[[ -f "$MANIFEST" ]] || fail "missing source smoke manifest: $MANIFEST"
command -v node >/dev/null 2>&1 || fail "Node.js is required"

# Syntax-check every helper first, including tests that are intentionally device-only.
for script in tools/*.sh; do bash -n "$script" || fail "shell syntax failed: $script"; done
for script in tools/*.js; do node --check "$script" >/dev/null || fail "JS syntax failed: $script"; done

# Reject duplicate manifest entries so coverage changes remain reviewable.
duplicates="$(grep -Ev '^[[:space:]]*(#|$)' "$MANIFEST" | sed 's/[[:space:]]*$//' | sort | uniq -d || true)"
[[ -z "$duplicates" ]] || fail "duplicate source smoke entries: $duplicates"

status=0
count=0
while IFS= read -r raw || [[ -n "$raw" ]]; do
  test_name="${raw%%#*}"
  test_name="$(printf '%s' "$test_name" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -n "$test_name" ]] || continue
  case "$test_name" in
    */*|*..*) fail "invalid source smoke entry: $test_name" ;;
  esac
  [[ -f "$ROOT/tools/$test_name" ]] || fail "listed source smoke does not exist: $test_name"
  count=$((count+1))
  if ! node "tools/$test_name"; then
    printf 'FAILED_SMOKE=%s\n' "$test_name" >&2
    status=1
  fi
done < "$MANIFEST"

if ! bash tools/ntp-time-smoke.sh; then
  printf 'FAILED_SMOKE=ntp-time-smoke.sh\n' >&2
  status=1
fi
printf 'Canonical source smokes executed: %d Node tests + ntp-time-smoke.sh\n' "$count"
exit "$status"
