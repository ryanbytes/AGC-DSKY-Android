#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  printf 'BUILD FAIL: %s\n' "$*" >&2
  exit 1
}

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

ROOT_HEAD="$(git rev-parse HEAD 2>/dev/null || true)"
[[ "$ROOT_HEAD" =~ ^[0-9a-fA-F]{40}$ ]] \
  || fail "repository HEAD could not be resolved to a Git commit"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] \
  || fail "repository has uncommitted/untracked source changes; commit or remove them before producing a verified APK"

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

if command -v gradle >/dev/null 2>&1; then
  GRADLE_CMD=("$(command -v gradle)")
  GRADLE_SOURCE="system"
else
  GRADLE_CMD=(bash "$ROOT/tools/gradle-bootstrap.sh")
  GRADLE_SOURCE="checksum-verified bootstrap"
fi

GRADLE_VERSION="$("${GRADLE_CMD[@]}" --version | awk '/^Gradle / { print $2; exit }')"
[[ -n "$GRADLE_VERSION" ]] || fail "unable to determine Gradle version"
is_stable_triplet "$GRADLE_VERSION" \
  || fail "use a stable Gradle release, not preview/prerelease $GRADLE_VERSION"
version_ge "$GRADLE_VERSION" 9.5.0 \
  || fail "AGP 9.3.0 requires Gradle 9.5.0 or newer; found $GRADLE_VERSION"

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK" ]] || fail "ANDROID_SDK_ROOT or ANDROID_HOME must point to the Android SDK"
[[ -d "$SDK" ]] || fail "Android SDK directory does not exist: $SDK"

# AGP 9.3 can resolve its compile SDK without a legacy physical
# $ANDROID_SDK_ROOT/platforms/android-37/android.jar entry. Do not reject a
# valid toolchain before Gradle has a chance to resolve compileSdk 37.
BUILD_TOOLS_VERSION=36.0.0
BUILD_TOOLS_DIR="$SDK/build-tools/$BUILD_TOOLS_VERSION"
[[ -d "$BUILD_TOOLS_DIR" ]] \
  || fail "Android SDK Build Tools $BUILD_TOOLS_VERSION is required at $BUILD_TOOLS_DIR"
[[ -x "$BUILD_TOOLS_DIR/aapt2" ]] \
  || fail "Build Tools $BUILD_TOOLS_VERSION aapt2 is missing or not executable"
[[ -x "$BUILD_TOOLS_DIR/apksigner" ]] \
  || fail "Build Tools $BUILD_TOOLS_VERSION apksigner is missing or not executable"

PINNED_WEBAGC=0575ea7a1231e3948bae7d2c22a6ac146da0c38d
WEBAGC_GITLINK="$(git rev-parse HEAD:vendor/webAGC 2>/dev/null || true)"
[[ "$WEBAGC_GITLINK" == "$PINNED_WEBAGC" ]] \
  || fail "repository gitlink for vendor/webAGC is ${WEBAGC_GITLINK:-unknown}; expected $PINNED_WEBAGC"
[[ -d vendor/webAGC/.git || -f vendor/webAGC/.git ]] \
  || fail "vendor/webAGC submodule is not initialized; run: git submodule update --init --recursive"
WEBAGC_HEAD="$(git -C vendor/webAGC rev-parse HEAD 2>/dev/null || true)"
[[ "$WEBAGC_HEAD" == "$PINNED_WEBAGC" ]] \
  || fail "vendor/webAGC is at ${WEBAGC_HEAD:-unknown}; expected $PINNED_WEBAGC. Run: git submodule update --init --recursive"
[[ -z "$(git -C vendor/webAGC status --porcelain)" ]] \
  || fail "vendor/webAGC has local modifications; refusing a non-reproducible build"

required_assets=(
  vendor/webAGC/src/yaAGC.wasm
  vendor/webAGC/demo/agc/Comanche055.bin
)
for asset in "${required_assets[@]}"; do
  [[ -f "$asset" ]] \
    || fail "missing $asset; run: git submodule update --init --recursive"
done

for script in tools/*.sh; do
  bash -n "$script" || fail "shell syntax check failed: $script"
done
for script in tools/*.js; do
  node --check "$script" >/dev/null \
    || fail "JavaScript syntax check failed: $script"
done

printf 'Source commit: %s\n' "$ROOT_HEAD"
printf 'Java: %s\n' "$JAVA_VERSION"
printf 'Node: %s\n' "$NODE_VERSION"
printf 'Gradle: %s (%s)\n' "$GRADLE_VERSION" "$GRADLE_SOURCE"
printf 'Android SDK: %s\n' "$SDK"
printf 'compileSdk: 37 (resolved by Android Gradle Plugin)\n'
printf 'Build Tools: %s\n' "$BUILD_TOOLS_VERSION"
printf 'webAGC gitlink: %s\n' "$WEBAGC_GITLINK"
printf 'webAGC checkout: %s\n' "$WEBAGC_HEAD"

node tools/branding-smoke.js
node tools/manifest-policy-smoke.js
bash tools/ntp-time-smoke.sh
node tools/ntp-policy-smoke.js
node tools/fire-home-setup-smoke.js
node tools/csp-smoke.js
node tools/frontend-smoke.js
node tools/cheatsheet-smoke.js
node tools/optics-lifecycle-smoke.js
node tools/device-v35-policy-smoke.js
node tools/display-layout-smoke.js
node tools/el-widget-smoke.js
node tools/solar-model-smoke.js
node tools/agc-core-smoke.js
node tools/native-diagnostic-smoke.js
node tools/dsky-mapping-smoke.js
node tools/flight-hardware-ui-smoke.js
node tools/keyboard-electrical-interlock-smoke.js
node tools/lighting-electrical-model-smoke.js
node tools/v35-model-smoke.js
node tools/asset-reference-smoke.js
node tools/wasm-runtime-smoke.js

# Build from a clean app tree so stale generated assets cannot mask source drift.
"${GRADLE_CMD[@]}" --no-daemon --stacktrace \
  :app:clean :app:verifyPinnedAgcAssets :app:assembleRegularDebug :app:assembleFireDebug

REGULAR_APK="$ROOT/app/build/outputs/apk/regular/debug/app-regular-debug.apk"
FIRE_APK="$ROOT/app/build/outputs/apk/fire/debug/app-fire-debug.apk"
[[ -f "$REGULAR_APK" ]] || fail "Gradle reported success but regular debug APK is missing: $REGULAR_APK"
[[ -f "$FIRE_APK" ]] || fail "Gradle reported success but Fire debug APK is missing: $FIRE_APK"

bash tools/verify-apk.sh "$REGULAR_APK" regular
bash tools/verify-apk.sh "$FIRE_APK" fire

printf 'Local regular + Fire debug build: PASS\n'
printf 'Source commit: %s\n' "$ROOT_HEAD"
printf 'Regular APK: %s\n' "$REGULAR_APK"
printf 'Fire APK: %s\n' "$FIRE_APK"
