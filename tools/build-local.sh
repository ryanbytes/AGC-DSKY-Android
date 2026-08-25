#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  printf 'BUILD FAIL: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required"
command -v java >/dev/null 2>&1 || fail "Java/JDK is required"
command -v gradle >/dev/null 2>&1 \
  || fail "Gradle is not installed. This repository does not currently contain a Gradle wrapper; install Gradle 9.5.0 or newer before building."

JAVA_VERSION="$(java -version 2>&1 | awk -F '"' '/version/ { print $2; exit }')"
[[ -n "$JAVA_VERSION" ]] || fail "unable to determine Java version"
JAVA_MAJOR="${JAVA_VERSION%%.*}"
if [[ "$JAVA_MAJOR" == "1" ]]; then
  JAVA_MAJOR="$(cut -d. -f2 <<<"$JAVA_VERSION")"
fi
[[ "$JAVA_MAJOR" =~ ^[0-9]+$ ]] || fail "unable to parse Java version: $JAVA_VERSION"
(( JAVA_MAJOR >= 17 )) \
  || fail "AGP 9.3.0 requires JDK 17 or newer; found Java $JAVA_VERSION"

GRADLE_VERSION="$(gradle --version | awk '/^Gradle / { print $2; exit }')"
[[ -n "$GRADLE_VERSION" ]] || fail "unable to determine Gradle version"
GRADLE_NUMERIC="${GRADLE_VERSION%%-*}"
IFS=. read -r GRADLE_MAJOR GRADLE_MINOR GRADLE_PATCH <<<"$GRADLE_NUMERIC"
GRADLE_MAJOR="${GRADLE_MAJOR:-0}"
GRADLE_MINOR="${GRADLE_MINOR:-0}"
GRADLE_PATCH="${GRADLE_PATCH:-0}"
if (( GRADLE_MAJOR < 9 || (GRADLE_MAJOR == 9 && GRADLE_MINOR < 5) )); then
  fail "AGP 9.3.0 requires Gradle 9.5.0 or newer; found $GRADLE_VERSION"
fi

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK" ]] || fail "ANDROID_SDK_ROOT or ANDROID_HOME must point to the Android SDK"
[[ -d "$SDK" ]] || fail "Android SDK directory does not exist: $SDK"
[[ -d "$SDK/platforms/android-37" ]] \
  || fail "Android SDK platform 37 is not installed under $SDK/platforms/android-37"

BUILD_TOOLS_VERSION=""
if [[ -d "$SDK/build-tools" ]]; then
  BUILD_TOOLS_VERSION="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null \
    | sort -V | tail -n 1)"
fi
# BSD/macOS find does not support -printf; fall back to basename expansion.
if [[ -z "$BUILD_TOOLS_VERSION" && -d "$SDK/build-tools" ]]; then
  BUILD_TOOLS_VERSION="$(for d in "$SDK"/build-tools/*; do
    [[ -d "$d" ]] && basename "$d"
  done | sort -V | tail -n 1)"
fi
[[ -n "$BUILD_TOOLS_VERSION" ]] \
  || fail "Android SDK Build Tools are not installed under $SDK/build-tools"
if [[ "$(printf '%s\n%s\n' 36.0.0 "$BUILD_TOOLS_VERSION" | sort -V | head -n 1)" != "36.0.0" ]]; then
  fail "AGP 9.3.0 requires SDK Build Tools 36.0.0 or newer; found $BUILD_TOOLS_VERSION"
fi

PINNED_WEBAGC=0575ea7a1231e3948bae7d2c22a6ac146da0c38d
[[ -d vendor/webAGC/.git || -f vendor/webAGC/.git ]] \
  || fail "vendor/webAGC submodule is not initialized; run: git submodule update --init --recursive"
WEBAGC_HEAD="$(git -C vendor/webAGC rev-parse HEAD 2>/dev/null || true)"
[[ "$WEBAGC_HEAD" == "$PINNED_WEBAGC" ]] \
  || fail "vendor/webAGC is at ${WEBAGC_HEAD:-unknown}; expected $PINNED_WEBAGC. Run: git submodule update --init --recursive"
[[ -z "$(git -C vendor/webAGC status --porcelain)" ]] \
  || fail "vendor/webAGC has local modifications; refusing a non-reproducible build"

required_assets=(
  vendor/webAGC/src/yaAGC.wasm
  vendor/webAGC/demo/agc/Luminary099.bin
  vendor/webAGC/demo/agc/Comanche055.bin
)
for asset in "${required_assets[@]}"; do
  [[ -f "$asset" ]] \
    || fail "missing $asset; run: git submodule update --init --recursive"
done

printf 'Java: %s\n' "$JAVA_VERSION"
printf 'Gradle: %s\n' "$GRADLE_VERSION"
printf 'Android SDK: %s\n' "$SDK"
printf 'SDK platform: android-37\n'
printf 'Build Tools: %s\n' "$BUILD_TOOLS_VERSION"
printf 'webAGC: %s\n' "$WEBAGC_HEAD"

if command -v node >/dev/null 2>&1; then
  node tools/frontend-smoke.js
  node tools/agc-core-smoke.js
else
  printf 'NOTE: node not found; JavaScript smoke tests skipped.\n' >&2
fi

gradle --no-daemon --stacktrace :app:verifyPinnedAgcAssets :app:assembleDebug

APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
[[ -f "$APK" ]] || fail "Gradle reported success but debug APK is missing: $APK"

bash tools/verify-apk.sh "$APK"

printf 'Local debug build: PASS\n'
printf 'APK: %s\n' "$APK"
