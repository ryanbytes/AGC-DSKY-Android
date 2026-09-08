#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-$ROOT/app/build/outputs/apk/debug/app-debug.apk}"
PINNED_BUILD_TOOLS=36.0.0
ASSET_SOURCE="$ROOT/app/src/main/assets"
BUILD_GRADLE="$ROOT/app/build.gradle"

fail() {
  printf 'VERIFY FAIL: %s\n' "$*" >&2
  exit 1
}

[[ -f "$APK" ]] || fail "APK not found: $APK"
[[ -f "$BUILD_GRADLE" ]] || fail "app/build.gradle is missing"
command -v unzip >/dev/null 2>&1 || fail "unzip is required"
command -v git >/dev/null 2>&1 || fail "git is required for Git-blob verification"
command -v cmp >/dev/null 2>&1 || fail "cmp is required for packaged-source verification"
command -v grep >/dev/null 2>&1 || fail "grep is required for frontend-reference verification"
command -v sed >/dev/null 2>&1 || fail "sed is required for frontend-reference verification"

EXPECTED_VERSION_CODE="$(sed -nE 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+).*/\1/p' "$BUILD_GRADLE" | head -n1)"
EXPECTED_VERSION_NAME="$(sed -nE "s/^[[:space:]]*versionName[[:space:]]+'([^']+)'.*/\\1/p" "$BUILD_GRADLE" | head -n1)"
[[ "$EXPECTED_VERSION_CODE" =~ ^[0-9]+$ ]] \
  || fail "unable to parse versionCode from app/build.gradle"
[[ -n "$EXPECTED_VERSION_NAME" ]] \
  || fail "unable to parse versionName from app/build.gradle"

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
verify_blob assets/Comanche055.bin 73728 9e4ec167dc99ac12b233df07b6b91fef585e5015

# Prove that the APK contains the frontend/metadata from this checkout rather
# than stale assets from an older build tree. Verify index.html first, then
# discover every src=/href= asset it references and compare that file
# byte-for-byte.
verify_source_asset assets/index.html "$ASSET_SOURCE/index.html"
reference_count=0
while IFS= read -r ref; do
  [[ -n "$ref" ]] || continue
  reference_count=$((reference_count + 1))
  if [[ "$ref" == /* || "$ref" == *..* || "$ref" =~ ^[A-Za-z][A-Za-z0-9+.-]*: ]]; then
    fail "index.html contains non-local frontend reference: $ref"
  fi
  verify_source_asset "assets/$ref" "$ASSET_SOURCE/$ref"
done < <(
  grep -Eo '(src|href)="[^"]+"' "$ASSET_SOURCE/index.html" \
    | sed -E 's/^[^=]+="//; s/"$//'
)
(( reference_count > 0 )) || fail "index.html contains no frontend src/href assets to verify"
verify_source_asset assets/BUILD_SOURCE.txt "$ASSET_SOURCE/BUILD_SOURCE.txt"

apk_entries="$(unzip -Z1 "$APK")"

# Only the CM runtime is staged. Legacy LM rope and upstream helper/demo assets
# must not leak into the packaged application.
for forbidden in \
  assets/Luminary099.bin \
  assets/Validation.bin \
  assets/webAGC.js \
  assets/lib/wasm_c_utilities/load.js \
  assets/lib/wasm_c_utilities/strings.js; do
  if grep -Fxq "$forbidden" <<<"$apk_entries"; then
    fail "unexpected unused vendor asset packaged: $forbidden"
  fi
done

# The v0.38.3 DSKY-only runtime intentionally packages no raster spacecraft
# panel photographs.
if grep -Eiq '^assets/.*\.(jpe?g|webp)$' <<<"$apk_entries"; then
  grep -Ei '^assets/.*\.(jpe?g|webp)$' <<<"$apk_entries" >&2 || true
  fail "unexpected raster spacecraft-panel asset packaged"
fi

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK" ]] \
  || fail "ANDROID_SDK_ROOT or ANDROID_HOME must be set so verification uses pinned Build Tools $PINNED_BUILD_TOOLS"
[[ -d "$SDK" ]] || fail "Android SDK directory does not exist: $SDK"

find_verifier_tool() {
  local name="$1"
  local pinned="$SDK/build-tools/$PINNED_BUILD_TOOLS/$name"
  [[ -x "$pinned" ]] || return 1
  printf '%s\n' "$pinned"
}

AAPT2="$(find_verifier_tool aapt2 || true)"
[[ -n "$AAPT2" ]] \
  || fail "aapt2 not found at pinned Build Tools $PINNED_BUILD_TOOLS under $SDK/build-tools"

badging="$($AAPT2 dump badging "$APK")"
grep -Eq "^package: name='org\\.apollo\\.agcdsky' versionCode='${EXPECTED_VERSION_CODE}' versionName='${EXPECTED_VERSION_NAME//./\\.}'" <<<"$badging" \
  || fail "APK package/version does not match org.apollo.agcdsky ${EXPECTED_VERSION_CODE}/${EXPECTED_VERSION_NAME} from app/build.gradle"
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

grep -Fq 'android.permission.CAMERA' <<<"$permissions" \
  || fail "merged APK is missing camera permission required for optics"
grep -Fq 'android.permission.ACCESS_COARSE_LOCATION' <<<"$permissions" \
  || fail "merged APK is missing coarse location required for solar/sky behavior"
grep -Fq 'android.permission.ACCESS_FINE_LOCATION' <<<"$permissions" \
  || fail "merged APK is missing fine location required for WebView geolocation compatibility"

# Verify that the packaged application really contains the EL-only AppWidget.
manifest_tree="$($AAPT2 dump xmltree --file AndroidManifest.xml "$APK")"
grep -Fq '="org.apollo.agcdsky.ElWidgetProvider"' <<<"$manifest_tree" \
  || grep -Fq '=".ElWidgetProvider"' <<<"$manifest_tree" \
  || fail "merged manifest is missing ElWidgetProvider receiver"
grep -Fq 'android.appwidget.action.APPWIDGET_UPDATE' <<<"$manifest_tree" \
  || fail "merged manifest is missing APPWIDGET_UPDATE action"
grep -Fq 'android.appwidget.provider' <<<"$manifest_tree" \
  || fail "merged manifest is missing appwidget provider metadata"

grep -Fq '="org.apollo.agcdsky.SensorMainActivity"' <<<"$manifest_tree" \
  || grep -Fq '=".SensorMainActivity"' <<<"$manifest_tree" \
  || fail "merged manifest is missing SensorMainActivity launcher target"

resources="$($AAPT2 dump resources "$APK")"
grep -Eq 'resource 0x[0-9a-f]+ id/el_widget_image' <<<"$resources" \
  || fail "APK resource table is missing el_widget_image"
grep -Eq 'resource 0x[0-9a-f]+ layout/el_widget' <<<"$resources" \
  || fail "APK resource table is missing layout/el_widget"
grep -Eq 'resource 0x[0-9a-f]+ xml/el_widget_info' <<<"$resources" \
  || fail "APK resource table is missing xml/el_widget_info"

DEXDUMP="$(find_verifier_tool dexdump || true)"
[[ -n "$DEXDUMP" ]] \
  || fail "dexdump not found at pinned Build Tools $PINNED_BUILD_TOOLS under $SDK/build-tools"
dexdump_output="$("$DEXDUMP" -f "$APK" 2>/dev/null)"
grep -Fq "Class descriptor  : 'Lorg/apollo/agcdsky/ElWidgetProvider;'" <<<"$dexdump_output" \
  || fail "APK dex is missing ElWidgetProvider class"
grep -Fq "Class descriptor  : 'Lorg/apollo/agcdsky/SensorMainActivity;'" <<<"$dexdump_output" \
  || fail "APK dex is missing SensorMainActivity class"

APKSIGNER="$(find_verifier_tool apksigner || true)"
[[ -n "$APKSIGNER" ]] \
  || fail "apksigner not found at pinned Build Tools $PINNED_BUILD_TOOLS under $SDK/build-tools"
"$APKSIGNER" verify --verbose "$APK" >/dev/null \
  || fail "APK signature verification failed"

printf 'APK verification: PASS\n'
printf '  %s\n' "$APK"
printf '  package/version/minSdk/targetSdk match source (%s / %s)\n' "$EXPECTED_VERSION_CODE" "$EXPECTED_VERSION_NAME"
printf '  APK is debuggable for the ADB smoke/report workflow\n'
printf '  pinned yaAGC/WASM + Comanche 055 rope match exact Git blobs\n'
printf '  index.html and every referenced frontend asset match the current checkout byte-for-byte\n'
printf '  SensorMainActivity and EL AppWidget classes/resources are packaged\n'
printf '  LM rope, raster panel images, and unused upstream vendor assets are absent\n'
printf '  merged manifest has camera/location permissions and no INTERNET permission\n'
printf '  verifier Build Tools: %s\n' "$PINNED_BUILD_TOOLS"
printf '  APK signature verifies\n'
