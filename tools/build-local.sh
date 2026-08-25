#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  printf 'BUILD FAIL: %s\n' "$*" >&2
  exit 1
}

# Numeric dotted-version comparison without GNU sort -V. This must work with
# the Bash 3.2 / BSD userland still present on many macOS installations.
version_ge() {
  local lhs="$1" rhs="$2"
  local l1=0 l2=0 l3=0 r1=0 r2=0 r3=0
  IFS=. read -r l1 l2 l3 <<<"$lhs"
  IFS=. read -r r1 r2 r3 <<<"$rhs"
  l1="${l1:-0}"; l2="${l2:-0}"; l3="${l3:-0}"
  r1="${r1:-0}"; r2="${r2:-0}"; r3="${r3:-0}"
  (( 10#$l1 > 10#$r1 )) && return 0
  (( 10#$l1 < 10#$r1 )) && return 1
  (( 10#$l2 > 10#$r2 )) && return 0
  (( 10#$l2 < 10#$r2 )) && return 1
  (( 10#$l3 >= 10#$r3 ))
}

is_stable_triplet() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

command -v git >/dev/null 2>&1 || fail "git is required"
command -v java >/dev/null 2>&1 || fail "Java/JDK is required"
command -v node >/dev/null 2>&1 \
  || fail "Node.js is required for the repository JavaScript/source smoke tests"
command -v gradle >/dev/null 2>&1 \
  || fail "Gradle is not installed. This repository does not currently contain a Gradle wrapper; install stable Gradle 9.5.0 or newer before building."

JAVA_VERSION="$(java -version 2>&1 | awk -F '"' '/version/ { print $2; exit }')"
[[ -n "$JAVA_VERSION" ]] || fail "unable to determine Java version"
JAVA_MAJOR="${JAVA_VERSION%%.*}"
if [[ "$JAVA_MAJOR" == "1" ]]; then
  JAVA_MAJOR="$(cut -d. -f2 <<<"$JAVA_VERSION")"
fi
[[ "$JAVA_MAJOR" =~ ^[0-9]+$ ]] || fail "unable to parse Java version: $JAVA_VERSION"
(( JAVA_MAJOR >= 17 )) \
  || fail "AGP 9.3.0 requires JDK 17 or newer; found Java $JAVA_VERSION"

NODE_VERSION="$(node --version | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
[[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] || fail "unable to parse Node.js version: $NODE_VERSION"
(( NODE_MAJOR >= 18 )) \
  || fail "Node.js 18 or newer is required for source smoke tests; found $NODE_VERSION"

GRADLE_VERSION="$(gradle --version | awk '/^Gradle / { print $2; exit }')"
[[ -n "$GRADLE_VERSION" ]] || fail "unable to determine Gradle version"
is_stable_triplet "$GRADLE_VERSION" \
  || fail "use a stable Gradle release, not preview/prerelease $GRADLE_VERSION"
version_ge "$GRADLE_VERSION" 9.5.0 \
  || fail "AGP 9.3.0 requires Gradle 9.5.0 or newer; found $GRADLE_VERSION"

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK" ]] || fail "ANDROID_SDK_ROOT or ANDROID_HOME must point to the Android SDK"
[[ -d "$SDK" ]] || fail "Android SDK directory does not exist: $SDK"
[[ -f "$SDK/platforms/android-37/android.jar" ]] \
  || fail "Android SDK platform 37/android.jar is not installed under $SDK/platforms/android-37"

BUILD_TOOLS_VERSION=36.0.0
BUILD_TOOLS_DIR="$SDK/build-tools/$BUILD_TOOLS_VERSION"
[[ -d "$BUILD_TOOLS_DIR" ]] \
  || fail "Android SDK Build Tools $BUILD_TOOLS_VERSION is required at $BUILD_TOOLS_DIR"
[[ -x "$BUILD_TOOLS_DIR/aapt2" ]] \
  || fail "Build Tools $BUILD_TOOLS_VERSION aapt2 is missing or not executable"
[[ -x "$BUILD_TOOLS_DIR/apksigner" ]] \
  || fail "Build Tools $BUILD_TOOLS_VERSION apksigner is missing or not executable"

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

# Catch shell portability/syntax regressions in every repository helper before
# Gradle starts doing expensive work.
for script in tools/*.sh; do
  bash -n "$script" || fail "shell syntax check failed: $script"
done

printf 'Java: %s\n' "$JAVA_VERSION"
printf 'Node: %s\n' "$NODE_VERSION"
printf 'Gradle: %s\n' "$GRADLE_VERSION"
printf 'Android SDK: %s\n' "$SDK"
printf 'SDK platform: android-37\n'
printf 'Build Tools: %s\n' "$BUILD_TOOLS_VERSION"
printf 'webAGC: %s\n' "$WEBAGC_HEAD"

node tools/frontend-smoke.js
node tools/agc-core-smoke.js
node tools/runtime-debug-smoke.js
node tools/dsky-mapping-smoke.js
node tools/asset-reference-smoke.js
node tools/wasm-runtime-smoke.js

# The accepted v0.7 APK is deliberately produced from a clean app build tree.
# Asset staging is a Sync task and the APK verifier checks bytes again, but a
# clean assemble removes one more source of misleading stale intermediates.
gradle --no-daemon --stacktrace :app:clean :app:verifyPinnedAgcAssets :app:assembleDebug

APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
[[ -f "$APK" ]] || fail "Gradle reported success but debug APK is missing: $APK"

bash tools/verify-apk.sh "$APK"

printf 'Local debug build: PASS\n'
printf 'APK: %s\n' "$APK"
