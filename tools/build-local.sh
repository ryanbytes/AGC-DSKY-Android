#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { printf 'BUILD FAIL: %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null 2>&1 || fail "git is required"
command -v java >/dev/null 2>&1 || fail "Java/JDK is required"
command -v node >/dev/null 2>&1 || fail "Node.js is required"

ROOT_HEAD="$(git rev-parse HEAD 2>/dev/null || true)"
[[ "$ROOT_HEAD" =~ ^[0-9a-fA-F]{40}$ ]] || fail "repository HEAD could not be resolved"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || fail "repository has uncommitted/untracked source changes"

JAVA_VERSION="$(java -version 2>&1 | awk -F '"' '/version/ { print $2; exit }')"
JAVA_MAJOR="${JAVA_VERSION%%.*}"
if [[ "$JAVA_MAJOR" == "1" ]]; then JAVA_MAJOR="$(cut -d. -f2 <<<"$JAVA_VERSION")"; fi
[[ "$JAVA_MAJOR" =~ ^[0-9]+$ ]] && (( JAVA_MAJOR >= 17 )) || fail "JDK 17+ required; found $JAVA_VERSION"

NODE_VERSION="$(node --version | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
[[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] && (( NODE_MAJOR >= 18 )) || fail "Node.js 18+ required; found $NODE_VERSION"

if command -v gradle >/dev/null 2>&1; then
  GRADLE_CMD=("$(command -v gradle)")
else
  GRADLE_CMD=(bash "$ROOT/tools/gradle-bootstrap.sh")
fi

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
[[ -n "$SDK" && -d "$SDK" ]] || fail "ANDROID_SDK_ROOT or ANDROID_HOME must point to the Android SDK"
BUILD_TOOLS_DIR="$SDK/build-tools/36.0.0"
[[ -x "$BUILD_TOOLS_DIR/aapt2" && -x "$BUILD_TOOLS_DIR/apksigner" ]] || fail "Android Build Tools 36.0.0 are required"

PINNED_WEBAGC=0575ea7a1231e3948bae7d2c22a6ac146da0c38d
WEBAGC_GITLINK="$(git rev-parse HEAD:vendor/webAGC 2>/dev/null || true)"
[[ "$WEBAGC_GITLINK" == "$PINNED_WEBAGC" ]] || fail "vendor/webAGC gitlink mismatch"
[[ -d vendor/webAGC/.git || -f vendor/webAGC/.git ]] || fail "vendor/webAGC submodule is not initialized"
WEBAGC_HEAD="$(git -C vendor/webAGC rev-parse HEAD 2>/dev/null || true)"
[[ "$WEBAGC_HEAD" == "$PINNED_WEBAGC" ]] || fail "vendor/webAGC checkout mismatch"
[[ -z "$(git -C vendor/webAGC status --porcelain)" ]] || fail "vendor/webAGC has local modifications"

for asset in vendor/webAGC/src/yaAGC.wasm vendor/webAGC/demo/agc/Comanche055.bin; do
  [[ -f "$asset" ]] || fail "missing $asset"
done

for script in tools/*.sh; do bash -n "$script" || fail "shell syntax check failed: $script"; done
for script in tools/*.js; do node --check "$script" >/dev/null || fail "JavaScript syntax check failed: $script"; done

printf 'Source commit: %s\n' "$ROOT_HEAD"
printf 'Java: %s\n' "$JAVA_VERSION"
printf 'Node: %s\n' "$NODE_VERSION"
printf 'Android SDK: %s\n' "$SDK"
printf 'webAGC: %s\n' "$WEBAGC_HEAD"

node tools/branding-smoke.js
node tools/manifest-policy-smoke.js
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
node tools/v35-model-smoke.js
node tools/asset-reference-smoke.js
node tools/wasm-runtime-smoke.js

"${GRADLE_CMD[@]}" --no-daemon --stacktrace \
  :app:clean :app:verifyPinnedAgcAssets :app:assemblePlayDebug :app:assembleFireDebug

PLAY_APK="$ROOT/app/build/outputs/apk/play/debug/app-play-debug.apk"
FIRE_APK="$ROOT/app/build/outputs/apk/fire/debug/app-fire-debug.apk"
[[ -f "$PLAY_APK" ]] || fail "Play debug APK missing: $PLAY_APK"
[[ -f "$FIRE_APK" ]] || fail "Fire debug APK missing: $FIRE_APK"

bash tools/verify-apk.sh "$PLAY_APK"
bash tools/verify-apk.sh "$FIRE_APK"

printf 'Local Play + Fire debug build: PASS\n'
printf 'Play APK: %s\n' "$PLAY_APK"
printf 'Fire APK: %s\n' "$FIRE_APK"
