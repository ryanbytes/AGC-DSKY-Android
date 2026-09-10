#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-ryanbytes.github.io}"
API_BASE="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}/rum/site_info"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"

request() {
  curl --fail --silent --show-error \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H 'Content-Type: application/json' \
    "$@"
}

extract_existing_token() {
  python3 -c '
import json, sys
host = sys.argv[1]
data = json.load(sys.stdin)
if not data.get("success"):
    errors = "; ".join(str(e.get("message", e)) for e in data.get("errors", []))
    raise SystemExit("Cloudflare Web Analytics list failed: " + (errors or "unknown error"))
for site in data.get("result") or []:
    rules = site.get("rules") or []
    if any(rule.get("host") == host for rule in rules):
        token = site.get("site_token") or ""
        if token:
            print(token)
            raise SystemExit(0)
' "$HOST"
}

extract_created_token() {
  python3 -c '
import json, sys
data = json.load(sys.stdin)
if not data.get("success"):
    errors = "; ".join(str(e.get("message", e)) for e in data.get("errors", []))
    raise SystemExit("Cloudflare Web Analytics create failed: " + (errors or "unknown error"))
result = data.get("result") or {}
token = result.get("site_token") or ""
if not token:
    raise SystemExit("Cloudflare Web Analytics create response did not contain site_token")
print(token)
'
}

LIST_RESPONSE="$(request "$API_BASE/list?per_page=100&order_by=host")"
TOKEN="$(printf '%s' "$LIST_RESPONSE" | extract_existing_token)"

if [[ -z "$TOKEN" ]]; then
  CREATE_BODY="$(python3 -c 'import json,sys; print(json.dumps({"host": sys.argv[1], "auto_install": False}))' "$HOST")"
  CREATE_RESPONSE="$(request -X POST --data "$CREATE_BODY" "$API_BASE")"
  TOKEN="$(printf '%s' "$CREATE_RESPONSE" | extract_created_token)"
fi

[[ -n "$TOKEN" ]] || { echo 'Cloudflare Web Analytics site token is empty' >&2; exit 1; }
printf '%s\n' "$TOKEN"
