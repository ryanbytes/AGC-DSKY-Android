#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fail(){ printf 'UPDATE RELEASE FAIL: %s\n' "$*" >&2; exit 1; }
[[ $# -eq 2 ]] || fail "usage: $0 <signed-regular.apk> <signed-fire.apk>"
REGULAR="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
FIRE="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
[[ -f "$REGULAR" ]] || fail "regular APK not found: $REGULAR"
[[ -f "$FIRE" ]] || fail "Fire APK not found: $FIRE"
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK" && -d "$SDK" ]] || fail "ANDROID_SDK_ROOT or ANDROID_HOME must point to Android SDK"
APKSIGNER="$SDK/build-tools/36.0.0/apksigner"
AAPT2="$SDK/build-tools/36.0.0/aapt2"
DEXDUMP="$SDK/build-tools/36.0.0/dexdump"
[[ -x "$APKSIGNER" ]] || fail "Build Tools 36.0.0 apksigner is required"
[[ -x "$AAPT2" ]] || fail "Build Tools 36.0.0 aapt2 is required"
[[ -x "$DEXDUMP" ]] || fail "Build Tools 36.0.0 dexdump is required"
VERSION_FILE="$ROOT/VERSION"
[[ -f "$VERSION_FILE" ]] || fail "VERSION file not found: $VERSION_FILE"
EXPECTED_VERSION="$(tr -d '\r\n' < "$VERSION_FILE")"
[[ "$EXPECTED_VERSION" =~ ^[0-9]+(\.[0-9]+){1,3}$ ]] || fail "invalid VERSION value: $EXPECTED_VERSION"
EXPECTED_CERT_SHA256="409ad676e8052e50416a1bf69e095137ef639ac13ce4652160a19380a117fa1f"
verify_release_signature(){
  local label="$1" apk="$2" report actual_cert
  report="$("$APKSIGNER" verify --verbose --print-certs "$apk" 2>&1)" \
    || fail "$label APK signature verification failed"
  grep -Eq '^Verified using v(2|3(\.1)?|4) scheme .*: true$' <<<"$report" \
    || fail "$label APK must use APK Signature Scheme v2 or newer"
  actual_cert="$(sed -nE 's/^Signer #[0-9]+ certificate SHA-256 digest: ([[:xdigit:]:]+)$/\1/p' <<<"$report" \
    | tr -d ':' | tr '[:upper:]' '[:lower:]')"
  [[ "$actual_cert" == "$EXPECTED_CERT_SHA256" ]] \
    || fail "$label APK does not use the established AGC DSKY release certificate"
}
verify_release_signature regular "$REGULAR"
verify_release_signature Fire "$FIRE"
verify_release_apk(){
  local label="$1" apk="$2" badging package_name version_name dex_output component
  badging="$("$AAPT2" dump badging "$apk")" || fail "$label APK metadata could not be read"
  package_name="$(sed -nE "s/^package: name='([^']+)'.*/\1/p" <<<"$badging")"
  version_name="$(sed -nE "s/^package: .*versionName='([^']+)'.*/\1/p" <<<"$badging")"
  APK_VERSION_CODE="$(sed -nE "s/^package: .*versionCode='([^']+)'.*/\1/p" <<<"$badging")"
  [[ "$package_name" == org.apollo.agcdsky ]] || fail "$label APK has the wrong package name"
  [[ "$version_name" == "$EXPECTED_VERSION" ]] || fail "$label APK versionName does not match VERSION"
  [[ "$APK_VERSION_CODE" =~ ^[0-9]+$ ]] || fail "$label APK has invalid versionCode metadata"
  dex_output="$("$DEXDUMP" -f "$apk" 2>/dev/null)" || fail "$label APK dex could not be read"
  for component in FireModeActivity FireRedirectAccessibilityService FireBootReceiver; do
    if [[ "$label" == Fire ]]; then
      grep -Fq "Class descriptor  : 'Lorg/apollo/agcdsky/$component;'" <<<"$dex_output" \
        || fail "Fire APK is missing $component"
    else
      ! grep -Fq "Class descriptor  : 'Lorg/apollo/agcdsky/$component;'" <<<"$dex_output" \
        || fail "regular APK unexpectedly contains $component"
    fi
  done
}
verify_release_apk regular "$REGULAR"
REGULAR_VERSION_CODE="$APK_VERSION_CODE"
verify_release_apk Fire "$FIRE"
FIRE_VERSION_CODE="$APK_VERSION_CODE"
[[ "$REGULAR_VERSION_CODE" == "$FIRE_VERSION_CODE" ]] \
  || fail "Regular and Fire APK versionCode values do not match"
DIST="$ROOT/dist/update-release"
rm -rf "$DIST"; mkdir -p "$DIST"
cp "$REGULAR" "$DIST/app-regular-release.apk"
cp "$FIRE" "$DIST/app-fire-release.apk"
sha256_file(){
  local file="$1" out="$2" hash
  if command -v sha256sum >/dev/null 2>&1; then hash="$(sha256sum "$file" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then hash="$(shasum -a 256 "$file" | awk '{print $1}')"
  else fail "sha256sum or shasum is required"; fi
  printf '%s  %s\n' "$hash" "$(basename "$file")" > "$out"
}
sha256_file "$DIST/app-regular-release.apk" "$DIST/app-regular-release.apk.sha256"
sha256_file "$DIST/app-fire-release.apk" "$DIST/app-fire-release.apk.sha256"
printf 'Prepared updater release assets:\n  %s\n  %s\n  %s\n  %s\n' \
  "$DIST/app-regular-release.apk" "$DIST/app-regular-release.apk.sha256" \
  "$DIST/app-fire-release.apk" "$DIST/app-fire-release.apk.sha256"
printf 'Upload all four files to a non-draft, non-prerelease GitHub Release tagged v<version>.\n'
