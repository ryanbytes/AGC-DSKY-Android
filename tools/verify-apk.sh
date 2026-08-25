#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-$ROOT/app/build/outputs/apk/debug/app-debug.apk}"
PINNED_BUILD_TOOLS=36.0.0

fail() {
  printf 'VERIFY FAIL: %s\n' "$*" >&2
  exit 1
}

[[ -f "$APK" ]] || fail "APK not found: $APK"
command -v unzip >/dev/null 2>&1 || fail "unzip is required"
command -v git >/dev/null 2>&1 || fail "git is required for Git-blob verification"
command -v cmp >/dev/null 2>&1 || fail "cmp is required for packaged-source verification"

verify_blob() {
  local entry="$1"
  local expected_size="$2"
  local expected_blob="$3"
  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' RETURN

  unzip -p "$APK" "$entry" > "$tmp" || fail "missing APK entry: $entry"

  local actual_size actual_blob
  actual_size="$(wc -c < "$tmp" | tr -d '[:space:]')"
  [[ "$actual_size" == "$expected_size" ]] \
    || fail "$entry is $actual_size bytes; expected $expected_size"

  actual_blob="$(git hash-object "$tmp")"
  [[ "$actual_blob" == "$expected_blob" ]] \
    || fail "$entry Git blob $actual_blob; expected $expected_blob"

  rm -f "$tmp"
  trap - RETURN
}

verify_source_asset() {
  local entry="$1"
  local source="$2"
  local tmp
  [[ -f "$source" ]] || fail "source asset missing: $source"
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' RETURN
  unzip -p "$APK" "$entry" > "$tmp" || fail "missing APK entry: $entry"
  cmp -s "$source" "$tmp" || fail "$entry does not match current source: $source"
  rm -f "$tmp"
  trap - RETURN
}

verify_blob assets/yaAGC.wasm 132617 713685680492098d05437b99c26403f683d56009
verify_blob assets/Luminary099.bin 73728 cd2ec9992d5863e1c7234fa760020f68ef946202
verify_blob assets/Comanche055.bin 73728 9e4ec167dc99ac12b233df07b6b91fef585e5015

# Prove that the APK contains the frontend from this checkout, including the
# early runtime crash hook, rather than stale assets from an older build tree.
verify_source_asset assets/index.html "$ROOT/app/src/main/assets/index.html"
verify_source_asset assets/runtime-debug.js "$ROOT/app/src/main/assets/runtime-debug.js"
verify_source_asset assets/agc-core.js "$ROOT/app/src/main/assets/agc-core.js"
verify_source_asset assets/app.js "$ROOT/app/src/main/assets/app.js"
verify_source_asset assets/style.css "$ROOT/app/src/main/assets/style.css"
verify_source_asset assets/controls-layout.css "$ROOT/app/src/main/assets/controls-layout.css"
verify_source_asset assets/agc-state.css "$ROOT/app/src/main/assets/agc-state.css"

# The Android build stages only the three required vendor binaries. Whole
# upstream source/demo trees must never leak into the APK again.
apk_entries="$(unzip -Z1 "$APK")"
for forbidden in \
  assets/Validation.bin \
  assets/webAGC.js \
  assets/lib/wasm_c_utilities/load.js \
  assets/lib/wasm_c_utilities/strings.js; do
  if grep -Fxq "$forbidden" <<<"$apk_entries"; then
    fail "unexpected unused vendor asset packaged: $forbidden"
  fi
done

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"

find_verifier_tool() {
  local name="$1"
  if [[ -n "$SDK" ]]; then
    local pinned="$SDK/build-tools/$PINNED_BUILD_TOOLS/$name"
    [[ -x "$pinned" ]] || return 1
    printf '%s\n' "$pinned"
    return 0
  fi
  command -v "$name" 2>/dev/null || return 1
}

AAPT2="$(find_verifier_tool aapt2 || true)"
[[ -n "$AAPT2" ]] \
  || fail "aapt2 not found at pinned Build Tools $PINNED_BUILD_TOOLS (or PATH when no SDK is configured)"

badging="$($AAPT2 dump badging "$APK")"
grep -Eq "^package: name='org\.apollo\.agcdsky' versionCode='7' versionName='0\.7'" <<<"$badging" \
  || fail "APK package/version is not org.apollo.agcdsky versionCode 7 versionName 0.7"
grep -Fq "sdkVersion:'26'" <<<"$badging" \
  || fail "APK minSdk is not 26"
grep -Fq "targetSdkVersion:'37'" <<<"$badging" \
  || fail "APK targetSdk is not 37"
grep -Fq "application-debuggable" <<<"$badging" \
  || fail "test APK is not debuggable; device-smoke run-as diagnostics would not work"

permissions="$($AAPT2 dump permissions "$APK")"
if grep -Fq 'android.permission.INTERNET' <<<"$permissions"; then
  fail "merged APK requests android.permission.INTERNET"
fi

grep -Fq 'android.permission.ACCESS_COARSE_LOCATION' <<<"$permissions" \
  || fail "merged APK is missing coarse location required for DREAM SOLAR"
grep -Fq 'android.permission.ACCESS_FINE_LOCATION' <<<"$permissions" \
  || fail "merged APK is missing fine location required for WebView geolocation compatibility"

APKSIGNER="$(find_verifier_tool apksigner || true)"
[[ -n "$APKSIGNER" ]] \
  || fail "apksigner not found at pinned Build Tools $PINNED_BUILD_TOOLS (or PATH when no SDK is configured)"
"$APKSIGNER" verify --verbose "$APK" >/dev/null \
  || fail "APK signature verification failed"

printf 'APK verification: PASS\n'
printf '  %s\n' "$APK"
printf '  package/version/minSdk/targetSdk match v0.7 source\n'
printf '  APK is debuggable for the ADB smoke/report workflow\n'
printf '  pinned yaAGC/WASM + both ropes match exact Git blobs\n'
printf '  packaged frontend matches the current checkout byte-for-byte\n'
printf '  unused upstream vendor assets are absent\n'
printf '  merged manifest has location permissions and no INTERNET permission\n'
printf '  verifier Build Tools: %s\n' "$PINNED_BUILD_TOOLS"
printf '  APK signature verifies\n'
