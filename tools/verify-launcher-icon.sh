#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-$ROOT/app/build/outputs/apk/debug/app-debug.apk}"
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
AAPT2="$SDK/build-tools/36.0.0/aapt2"

fail() {
  printf 'ICON VERIFY FAIL: %s\n' "$*" >&2
  exit 1
}

[[ -f "$APK" ]] || fail "APK not found: $APK"
[[ -x "$AAPT2" ]] || fail "aapt2 not found: $AAPT2"

badging="$($AAPT2 dump badging "$APK")"
grep -Eq "^application: .*icon='[^']+'" <<<"$badging" \
  || fail "aapt2 does not report an application launcher icon"
grep -Eq "^application-icon-[0-9]+:'[^']+'" <<<"$badging" \
  || fail "aapt2 does not expose any density-resolved application icon"

resources="$($AAPT2 dump resources "$APK")"
grep -Fq 'mipmap/ic_launcher' <<<"$resources" \
  || fail "APK resource table is missing mipmap/ic_launcher"
grep -Fq 'mipmap/ic_launcher_round' <<<"$resources" \
  || fail "APK resource table is missing mipmap/ic_launcher_round"
grep -Fq 'mipmap/ic_launcher_original' <<<"$resources" \
  || fail "APK resource table is missing recovered launcher artwork"

entries="$(unzip -Z1 "$APK")"
grep -Eq '^res/mipmap-.*ic_launcher_original\.png$' <<<"$entries" \
  || fail "APK does not contain recovered launcher bitmap"
grep -Eq '^res/mipmap-anydpi-v26/ic_launcher\.xml$' <<<"$entries" \
  || fail "APK does not contain adaptive launcher icon XML"
grep -Eq '^res/mipmap-anydpi-v26/ic_launcher_round\.xml$' <<<"$entries" \
  || fail "APK does not contain adaptive round launcher icon XML"

printf 'launcher icon APK verification: PASS\n'
