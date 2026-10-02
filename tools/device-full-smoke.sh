#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-$ROOT/app/build/outputs/apk/regular/debug/app-regular-debug.apk}"

[[ -f "$APK" ]] || {
  printf 'DEVICE FULL SMOKE FAIL: APK not found: %s\n' "$APK" >&2
  exit 1
}

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK" && -x "$SDK/build-tools/36.0.0/aapt2" ]] || {
  printf 'DEVICE FULL SMOKE FAIL: Android SDK Build Tools 36.0.0 aapt2 is required\n' >&2
  exit 1
}
PACKAGE="$("$SDK/build-tools/36.0.0/aapt2" dump packagename "$APK")"
[[ "$PACKAGE" == 'org.apollo.agcdsky.eltest' ]] || {
  printf 'DEVICE FULL SMOKE FAIL: expected the isolated debuggable .eltest APK; found %s\n' "${PACKAGE:-unknown}" >&2
  exit 1
}

bash "$ROOT/tools/device-smoke.sh" "$APK"
bash "$ROOT/tools/device-agc-smoke.sh" "$PACKAGE"
bash "$ROOT/tools/device-process-recreation-smoke.sh" "$PACKAGE"

printf 'Device full smoke: PASS\n'
