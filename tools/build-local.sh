#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  printf 'BUILD FAIL: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required"
command -v gradle >/dev/null 2>&1 \
  || fail "Gradle is not installed. This repository does not currently contain a Gradle wrapper; install a compatible real Gradle distribution before building."

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK" ]] || fail "ANDROID_SDK_ROOT or ANDROID_HOME must point to the Android SDK"
[[ -d "$SDK" ]] || fail "Android SDK directory does not exist: $SDK"

required_assets=(
  vendor/webAGC/src/yaAGC.wasm
  vendor/webAGC/demo/agc/Luminary099.bin
  vendor/webAGC/demo/agc/Comanche055.bin
)
for asset in "${required_assets[@]}"; do
  [[ -f "$asset" ]] \
    || fail "missing $asset; run: git submodule update --init --recursive"
done

printf 'Java:\n'
java -version 2>&1 | sed 's/^/  /'
printf 'Gradle:\n'
gradle --version | sed 's/^/  /'
printf 'Android SDK: %s\n' "$SDK"

if command -v node >/dev/null 2>&1; then
  node tools/frontend-smoke.js
  node tools/agc-core-smoke.js
else
  printf 'NOTE: node not found; JavaScript smoke tests skipped.\n' >&2
fi

gradle --no-daemon :app:verifyPinnedAgcAssets :app:assembleDebug

APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
[[ -f "$APK" ]] || fail "Gradle reported success but debug APK is missing: $APK"

bash tools/verify-apk.sh "$APK"

printf 'Local debug build: PASS\n'
printf 'APK: %s\n' "$APK"
