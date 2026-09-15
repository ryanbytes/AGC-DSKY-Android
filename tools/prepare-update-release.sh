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
[[ -x "$APKSIGNER" ]] || fail "Build Tools 36.0.0 apksigner is required"
"$APKSIGNER" verify --verbose --print-certs "$REGULAR" >/dev/null || fail "regular APK signature verification failed"
"$APKSIGNER" verify --verbose --print-certs "$FIRE" >/dev/null || fail "Fire APK signature verification failed"
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
