#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-$ROOT/app/build/outputs/apk/debug/app-debug.apk}"

[[ -f "$APK" ]] || {
  printf 'DEVICE FULL SMOKE FAIL: APK not found: %s\n' "$APK" >&2
  exit 1
}

bash "$ROOT/tools/device-smoke.sh" "$APK"
bash "$ROOT/tools/device-agc-smoke.sh"

printf 'Device full smoke: PASS\n'
