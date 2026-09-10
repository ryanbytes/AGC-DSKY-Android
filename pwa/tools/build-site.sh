#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_ASSETS="$ROOT/app/src/main/assets"
WEBAGC="$ROOT/vendor/webAGC"
PWA="$ROOT/pwa"
DEST="${1:-$PWA/dist}"
ANALYTICS_ENDPOINT="${AGC_ANALYTICS_ENDPOINT:-}"

fail() {
  printf 'PWA BUILD FAIL: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"
command -v rsync >/dev/null 2>&1 || fail "rsync is required"

"$ROOT/apple/tools/verify-pinned-assets.sh"
[[ -d "$SOURCE_ASSETS" ]] || fail "shared web assets are missing: $SOURCE_ASSETS"

rm -rf "$DEST"
mkdir -p "$DEST"
rsync -a --delete --exclude '.DS_Store' "$SOURCE_ASSETS/" "$DEST/"
mkdir -p "$DEST/icons"
cp "$WEBAGC/src/yaAGC.wasm" "$DEST/yaAGC.wasm"
cp "$WEBAGC/demo/agc/Comanche055.bin" "$DEST/Comanche055.bin"
cp "$PWA/manifest.webmanifest" "$DEST/manifest.webmanifest"
cp "$PWA/static/pwa-bootstrap.js" "$DEST/pwa-bootstrap.js"
cp "$PWA/static/pwa-sensor-parity.js" "$DEST/pwa-sensor-parity.js"
cp "$PWA/static/analytics.js" "$DEST/analytics.js"
cp "$PWA/static/sw.js" "$DEST/sw.js"
cp "$PWA/PRIVACY_POLICY.txt" "$DEST/PRIVACY_POLICY.txt"
cp "$PWA/icons/apple-touch-icon.png" "$DEST/icons/apple-touch-icon.png"
cp "$PWA/icons/icon-192.png" "$DEST/icons/icon-192.png"
cp "$PWA/icons/icon-512.png" "$DEST/icons/icon-512.png"
touch "$DEST/.nojekyll"

CACHE_VERSION="$(git -C "$ROOT" rev-parse --short=12 HEAD)"
python3 - "$DEST/sw.js" "$CACHE_VERSION" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
version = sys.argv[2]
text = path.read_text(encoding='utf-8')
if '__CACHE_VERSION__' not in text:
    raise SystemExit('service worker cache-version token missing')
path.write_text(text.replace('__CACHE_VERSION__', version), encoding='utf-8')
PY

python3 - "$DEST/analytics.js" "$CACHE_VERSION" "$ANALYTICS_ENDPOINT" <<'PY'
from pathlib import Path
import json, sys
path = Path(sys.argv[1])
version = sys.argv[2]
endpoint = sys.argv[3]
text = path.read_text(encoding='utf-8')
for token in ('__ANALYTICS_ENDPOINT_JSON__', '__APP_VERSION_JSON__'):
    if token not in text:
        raise SystemExit(f'analytics token missing: {token}')
text = text.replace('__ANALYTICS_ENDPOINT_JSON__', json.dumps(endpoint))
text = text.replace('__APP_VERSION_JSON__', json.dumps(version))
path.write_text(text, encoding='utf-8')
PY

python3 - "$DEST/index.html" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
head = '''\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#6f7571">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="AGC DSKY">\n<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">\n'''
boot = '\n<script src="pwa-sensor-parity.js"></script>\n<script src="pwa-bootstrap.js"></script>\n<script src="analytics.js"></script>\n'
if '</head>' not in text or '</body>' not in text:
    raise SystemExit('shared index.html is missing head/body closing tags')
if any(marker in text for marker in ('manifest.webmanifest', 'pwa-sensor-parity.js', 'pwa-bootstrap.js', 'analytics.js')):
    raise SystemExit('shared index.html already contains PWA injection markers')
text = text.replace('</head>', head + '</head>', 1)
text = text.replace('</body>', boot + '</body>', 1)
path.write_text(text, encoding='utf-8')
PY

printf 'PWA site staged: %s\n' "$DEST"
printf 'Cache version: %s\n' "$CACHE_VERSION"
if [[ -n "$ANALYTICS_ENDPOINT" ]]; then
  printf 'Analytics endpoint: %s\n' "$ANALYTICS_ENDPOINT"
else
  printf 'Analytics endpoint: disabled\n'
fi
