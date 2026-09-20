#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE="${1:?PWA site directory required}"
OUT="${2:?output directory required}"
PORT="${VISUAL_GOLDEN_PORT:-8765}"
BROWSER=""
for candidate in google-chrome google-chrome-stable chromium chromium-browser; do
  if command -v "$candidate" >/dev/null 2>&1; then BROWSER="$candidate"; break; fi
done
[[ -n "$BROWSER" ]] || { echo "VISUAL GOLDEN FAIL: Chromium/Chrome not installed" >&2; exit 1; }
mkdir -p "$OUT"
cp "$ROOT/tools/visual-golden-harness.html" "$SITE/visual-golden-harness.html"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SITE" >"$OUT/http.log" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT
sleep .5
cases=(normal display-only lamp-test diagnostics cheatsheet screen-only)
for case_name in "${cases[@]}"; do
  profile="$OUT/profile-$case_name"
  rm -rf "$profile"
  "$BROWSER" --headless --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check --disable-background-networking --disable-component-update --disable-sync --font-render-hinting=none --force-device-scale-factor=1 --window-size=412,915 --virtual-time-budget=4500 --user-data-dir="$profile" --screenshot="$OUT/$case_name.png" "http://127.0.0.1:$PORT/visual-golden-harness.html?case=$case_name" >/dev/null 2>&1
  test -s "$OUT/$case_name.png"
done
rm -rf "$OUT"/profile-*
printf 'Visual golden captures: %s\n' "$OUT"
