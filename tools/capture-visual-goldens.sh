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

probe_profile="$OUT/profile-probe"
probe_html="$OUT/runtime-probe.html"
rm -rf "$probe_profile"
"$BROWSER" --headless --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check --disable-background-networking --disable-component-update --disable-sync --font-render-hinting=none --force-device-scale-factor=1 --window-size=412,915 --virtual-time-budget=4500 --user-data-dir="$probe_profile" --dump-dom "http://127.0.0.1:$PORT/visual-golden-harness.html?case=probe" >"$probe_html" 2>/dev/null
python3 - "$probe_html" <<'PY'
from html import unescape
from pathlib import Path
import json, re, sys

text = Path(sys.argv[1]).read_text(encoding='utf-8')
match = re.search(r'<pre id="runtime-probe">(.*?)</pre>', text, flags=re.S)
if not match:
    raise SystemExit('VISUAL RUNTIME PROBE FAIL: runtime-probe payload missing')
payload = json.loads(unescape(match.group(1)))
print('VISUAL_RUNTIME_PROBE=' + json.dumps(payload, sort_keys=True, separators=(',', ':')))
a = payload.get('r1', {}).get('aPath')
d = payload.get('r1', {}).get('dPath')
if not a or not d:
    raise SystemExit('VISUAL RUNTIME PROBE FAIL: rendered a/d paths missing')
expected_a = 'M .199003944 .032239891 L .236689000 .097239891 L .410356000 .097239891 L .427798000 .032239891 Z'
expected_d = 'M .138381000 .462239891 L .068381000 .532239891 L .361195000 .532239891 L .322764000 .462239891 Z'
if a != expected_a:
    raise SystemExit('VISUAL RUNTIME PROBE FAIL: live top/E electrode path differs from accepted 1006315G geometry')
if d != expected_d:
    raise SystemExit('VISUAL RUNTIME PROBE FAIL: live bottom/N electrode path differs from accepted 1006315G geometry')
impl = payload.get('implementations', {})
if impl.get('glyph', {}).get('name') != 'apolloGlyph':
    raise SystemExit('VISUAL RUNTIME PROBE FAIL: Apollo glyph renderer is not live')
if impl.get('renderReg', {}).get('name') != 'apolloRenderReg':
    raise SystemExit('VISUAL RUNTIME PROBE FAIL: Apollo register renderer is not live')
r1 = payload.get('r1', {})
if r1.get('staticGlyphs') != 5 or r1.get('baseGlyphs') != 0:
    raise SystemExit('VISUAL RUNTIME PROBE FAIL: register is not using five static Apollo glyph slots')
PY

rm -rf "$OUT"/profile-*
printf 'Visual golden captures: %s\n' "$OUT"
