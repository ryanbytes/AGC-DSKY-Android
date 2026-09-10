#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="ryanbytes/AGC-DSKY-Android"
DB_NAME="agc-dsky-analytics"
WORKER_NAME="agc-dsky-analytics"
CONFIG="$DIR/wrangler.generated.json"
DEPLOY_LOG="$(mktemp)"
trap 'rm -f "$DEPLOY_LOG"' EXIT

fail() {
  printf 'ANALYTICS DEPLOY FAIL: %s\n' "$*" >&2
  exit 1
}

command -v npx >/dev/null 2>&1 || fail "Node.js/npm is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"
WRANGLER=(npx --yes wrangler@latest)

if ! "${WRANGLER[@]}" whoami >/dev/null 2>&1; then
  printf 'Opening Cloudflare login...\n'
  "${WRANGLER[@]}" login
fi

find_db_id() {
  "${WRANGLER[@]}" d1 list --json | python3 -c '
import json, sys
name = sys.argv[1]
for item in json.load(sys.stdin):
    if item.get("name") == name:
        print(item.get("uuid") or item.get("id") or "")
        break
' "$DB_NAME"
}

DB_ID="$(find_db_id)"
if [[ -z "$DB_ID" ]]; then
  printf 'Creating D1 database %s...\n' "$DB_NAME"
  "${WRANGLER[@]}" d1 create "$DB_NAME"
  DB_ID="$(find_db_id)"
fi
[[ -n "$DB_ID" ]] || fail "could not determine D1 database id"

python3 - "$CONFIG" "$DB_ID" <<'PY'
import json, sys
path, db_id = sys.argv[1:]
config = {
    "name": "agc-dsky-analytics",
    "main": "worker.js",
    "compatibility_date": "2026-09-09",
    "workers_dev": True,
    "vars": {"ALLOWED_ORIGINS": "https://ryanbytes.github.io"},
    "d1_databases": [{
        "binding": "DB",
        "database_name": "agc-dsky-analytics",
        "database_id": db_id,
        "migrations_dir": "migrations"
    }]
}
with open(path, "w", encoding="utf-8") as f:
    json.dump(config, f, indent=2)
    f.write("\n")
PY

printf 'Applying D1 migrations...\n'
"${WRANGLER[@]}" d1 migrations apply "$DB_NAME" --remote --config "$CONFIG"

printf 'Deploying Worker...\n'
"${WRANGLER[@]}" deploy --config "$CONFIG" | tee "$DEPLOY_LOG"

SECRET_LIST="$("${WRANGLER[@]}" secret list --config "$CONFIG" --format json 2>/dev/null || printf '[]')"
if ! printf '%s' "$SECRET_LIST" | python3 -c '
import json, sys
try:
    items = json.load(sys.stdin)
except Exception:
    items = []
raise SystemExit(0 if any(x.get("name") == "ANALYTICS_SECRET" for x in items) else 1)
'; then
  printf 'Creating persistent analytics HMAC secret...\n'
  if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 32)"
  else
    SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  fi
  printf '%s' "$SECRET" | "${WRANGLER[@]}" secret put ANALYTICS_SECRET --config "$CONFIG"
  unset SECRET
fi

WORKER_URL="$(grep -Eo 'https://[^[:space:]]+\.workers\.dev' "$DEPLOY_LOG" | tail -n 1 || true)"
if [[ -z "$WORKER_URL" ]]; then
  printf '\nWorker deployed. Copy its workers.dev URL from the output above and set GitHub variable AGC_ANALYTICS_ENDPOINT to it.\n'
  exit 0
fi

printf '\nAnalytics Worker: %s\nDashboard: %s/\n' "$WORKER_URL" "$WORKER_URL"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  printf 'Configuring the PWA to use this endpoint...\n'
  gh variable set AGC_ANALYTICS_ENDPOINT --repo "$REPO" --body "$WORKER_URL"
  gh workflow run pwa.yml --repo "$REPO"
  printf 'GitHub Pages rebuild requested.\n'
else
  cat <<EOF

To turn telemetry on in the public PWA, run:
  gh variable set AGC_ANALYTICS_ENDPOINT --repo $REPO --body "$WORKER_URL"
  gh workflow run pwa.yml --repo $REPO
EOF
fi
