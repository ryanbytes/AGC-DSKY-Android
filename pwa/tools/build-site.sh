#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_ASSETS="$ROOT/app/src/main/assets"
WEBAGC="$ROOT/vendor/webAGC"
CM_WASM="$ROOT/vendor/yaAGC-cm/yaAGC.wasm"
PWA="$ROOT/pwa"
REPLACE=0
if [[ "${1:-}" == "--replace" ]]; then
  REPLACE=1
  shift
fi
[[ $# -le 1 ]] || { printf 'PWA BUILD FAIL: usage: %s [--replace] [destination]\n' "$0" >&2; exit 1; }
DEST_INPUT="${1:-$PWA/dist}"

fail() {
  printf 'PWA BUILD FAIL: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"
command -v rsync >/dev/null 2>&1 || fail "rsync is required"

[[ ! -L "$DEST_INPUT" ]] || fail "destination is a symbolic link; refusing to write through it: $DEST_INPUT"
DEST="$(python3 - "$DEST_INPUT" <<'PY'
from pathlib import Path
import sys
print(Path(sys.argv[1]).expanduser().resolve(strict=False))
PY
)"

# The destination must never be the checkout, an input tree, or an ancestor of
# them. In particular, writing beneath SOURCE_ASSETS would make rsync copy its
# own output recursively. A fresh output beneath pwa/ (including pwa/dist) is
# allowed; only pwa/ itself is protected.
for protected in / "$ROOT" "$PWA"; do
  [[ "$DEST" != "$protected" ]] || fail "destination is a protected source/root path: $DEST"
done
case "$ROOT/" in
  "$DEST/"*) fail "destination would contain the repository checkout: $ROOT" ;;
esac
for protected in "$SOURCE_ASSETS" "$ROOT/vendor" "$WEBAGC"; do
  [[ "$DEST" != "$protected" ]] || fail "destination is a protected source/root path: $DEST"
  case "$protected/" in
    "$DEST/"*) fail "destination would contain a protected source/root path: $protected" ;;
  esac
  case "$DEST/" in
    "$protected/"*) fail "destination is inside a protected source/root path: $protected" ;;
  esac
done

if [[ -e "$DEST" ]]; then
  [[ -d "$DEST" ]] || fail "destination exists and is not a directory: $DEST"
  if [[ -n "$(find "$DEST" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    [[ "$REPLACE" == 1 ]] || fail "destination is populated; preserving existing files. Use --replace only when you intend to replace this output: $DEST"
    [[ -f "$DEST/.agcdsky-pwa-generated" ]] || fail "--replace requires a destination created by this builder; preserving unrecognized contents: $DEST"
    [[ "$(cat "$DEST/.agcdsky-pwa-generated")" == "AGC DSKY generated PWA output v1" ]] || fail "--replace destination marker is invalid; preserving existing files: $DEST"
    rm -rf -- "$DEST"
  fi
fi

"$ROOT/apple/tools/verify-pinned-assets.sh"
[[ -d "$SOURCE_ASSETS" ]] || fail "shared web assets are missing: $SOURCE_ASSETS"

mkdir -p "$DEST"
rsync -a --exclude '.DS_Store' --exclude '.self-contained-assets-note' "$SOURCE_ASSETS/" "$DEST/"
mkdir -p "$DEST/icons"
cp "$SOURCE_ASSETS/clock-behavior.js" "$DEST/clock-behavior-v2.js"
cp "$CM_WASM" "$DEST/yaAGC.wasm"
cp "$WEBAGC/demo/agc/Comanche055.bin" "$DEST/Comanche055.bin"
cp "$PWA/manifest.webmanifest" "$DEST/manifest.webmanifest"
cp "$PWA/static/pwa-bootstrap.js" "$DEST/pwa-bootstrap.js"
cp "$PWA/static/pwa-sensor-parity.js" "$DEST/pwa-sensor-parity.js"
cp "$PWA/static/pwa-auto-dim.js" "$DEST/pwa-auto-dim.js"
cp "$PWA/static/pwa-clock-guard.js" "$DEST/pwa-clock-guard.js"
cp "$PWA/static/pwa-print-bridge.js" "$DEST/pwa-print-bridge.js"
cp "$PWA/static/pwa-print.css" "$DEST/pwa-print.css"
cp "$PWA/static/pwa-print-android.css" "$DEST/pwa-print-android.css"
cp "$PWA/static/pwa-print-window.js" "$DEST/pwa-print-window.js"
cp "$PWA/static/sw.js" "$DEST/sw.js"
cp "$PWA/PRIVACY_POLICY.txt" "$DEST/PRIVACY_POLICY.txt"
cp "$PWA/icons/apple-touch-icon.png" "$DEST/icons/apple-touch-icon.png"
cp "$PWA/icons/icon-192.png" "$DEST/icons/icon-192.png"
cp "$PWA/icons/icon-512.png" "$DEST/icons/icon-512.png"
cp "$PWA/icons/icon-512-maskable.png" "$DEST/icons/icon-512-maskable.png"
touch "$DEST/.nojekyll"

CACHE_VERSION="$(git -C "$ROOT" rev-parse --short=12 HEAD)"
python3 - "$DEST/sw.js" "$CACHE_VERSION" "$SOURCE_ASSETS" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
version = sys.argv[2]
source_assets = Path(sys.argv[3])
text = path.read_text(encoding='utf-8')
version_token = '__CACHE_VERSION__'
asset_token = '/*__SHARED_ASSET_PRECACHE__*/'
if version_token not in text:
    raise SystemExit('service worker cache-version token missing')
if asset_token not in text:
    raise SystemExit('service worker shared-asset cache token missing')

shared = []
for file in sorted(p for p in source_assets.rglob('*') if p.is_file() and p.name not in {'.DS_Store', '.self-contained-assets-note'}):
    rel = file.relative_to(source_assets).as_posix()
    # PRIVACY_POLICY.txt is intentionally replaced by the PWA policy at the
    # same URL; caching that URL still makes the web policy available offline.
    escaped = rel.replace('\\', '\\\\').replace("'", "\\'")
    shared.append(f"  './{escaped}',")

text = text.replace(version_token, version)
text = text.replace(asset_token, '\n'.join(shared))
path.write_text(text, encoding='utf-8')
PY

python3 - "$DEST/index.html" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
policy = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri \'none\'; form-action \'none\'; object-src \'none\'; script-src \'self\' \'wasm-unsafe-eval\'; style-src \'self\'; img-src \'self\'; font-src \'self\'; connect-src \'self\'; media-src \'self\'; worker-src \'self\'; manifest-src \'self\'">'
if text.count(policy.split(' content="', 1)[0]) != 1:
    raise SystemExit('shared index.html must contain exactly one CSP meta policy')
old_policy_start = '<meta http-equiv="Content-Security-Policy"'
start = text.find(old_policy_start)
end = text.find('>', start) + 1 if start >= 0 else -1
if start < 0 or end <= start:
    raise SystemExit('shared index.html CSP meta policy missing')
text = text[:start] + policy + text[end:]
head = '''\n<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#6f7571">\n<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<meta name="apple-mobile-web-app-title" content="AGC DSKY">\n<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">\n'''
boot = '\n<script src="pwa-sensor-parity.js"></script>\n<script src="pwa-auto-dim.js"></script>\n<script src="pwa-clock-guard.js"></script>\n<script src="pwa-print-bridge.js"></script>\n<script src="pwa-bootstrap.js"></script>\n'
if '</head>' not in text or '</body>' not in text:
    raise SystemExit('shared index.html is missing head/body closing tags')
if '<script src="clock-behavior.js"></script>' not in text:
    raise SystemExit('shared index.html is missing clock behavior script')
if any(marker in text for marker in ('manifest.webmanifest', 'pwa-sensor-parity.js', 'pwa-auto-dim.js', 'pwa-clock-guard.js', 'pwa-print-bridge.js', 'pwa-bootstrap.js')):
    raise SystemExit('shared index.html already contains PWA injection markers')
# One-time filename change intentionally defeats any old service worker cache
# containing the experimental clock COMP ACTY helper.
text = text.replace('<script src="clock-behavior.js"></script>', '<script src="clock-behavior-v2.js"></script>', 1)
text = text.replace('</head>', head + '</head>', 1)
text = text.replace('</body>', boot + '</body>', 1)
path.write_text(text, encoding='utf-8')
PY

printf 'PWA site staged: %s\n' "$DEST"
printf 'Cache version: %s\n' "$CACHE_VERSION"
printf '%s\n' 'AGC DSKY generated PWA output v1' > "$DEST/.agcdsky-pwa-generated"
