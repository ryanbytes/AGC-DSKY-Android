#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE=org.apollo.agcdsky
ACTIVITY="$PACKAGE/.MainActivity"

fail() {
  printf 'DEVICE AGC SMOKE FAIL: %s\n' "$*" >&2
  exit 1
}

find_adb() {
  if command -v adb >/dev/null 2>&1; then
    command -v adb
    return 0
  fi
  local sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
  if [[ -n "$sdk" && -x "$sdk/platform-tools/adb" ]]; then
    printf '%s\n' "$sdk/platform-tools/adb"
    return 0
  fi
  return 1
}

command -v node >/dev/null 2>&1 || fail "Node.js 18+ is required"
NODE_VERSION="$(node --version | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
[[ "$NODE_MAJOR" =~ ^[0-9]+$ ]] && (( NODE_MAJOR >= 18 )) \
  || fail "Node.js 18+ is required; found ${NODE_VERSION:-unknown}"

ADB="$(find_adb || true)"
[[ -n "$ADB" ]] || fail "adb not found; install Android SDK Platform Tools or set ANDROID_SDK_ROOT"

DEVICE_COUNT="$($ADB devices | awk 'NR>1 && $2=="device" {n++} END {print n+0}')"
[[ "$DEVICE_COUNT" == "1" ]] \
  || fail "expected exactly one authorized ADB device; found $DEVICE_COUNT"

# Launch the interactive Activity if needed. The debug build enables WebView
# inspection only when FLAG_DEBUGGABLE is present. Process creation can precede
# WebView's localabstract DevTools socket, so poll for the actual socket rather
# than relying on a fixed cold-start sleep.
$ADB shell am start -W -n "$ACTIVITY" >/dev/null 2>&1 \
  || fail "could not launch $ACTIVITY"

PID=""
SOCKET=""
for _ in {1..40}; do
  PID="$($ADB shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' | awk '{print $1}')"
  if [[ "$PID" =~ ^[0-9]+$ ]]; then
    SOCKET="$($ADB shell cat /proc/net/unix 2>/dev/null \
      | tr -d '\r' \
      | awk -v pid="$PID" '
          $8 ~ /^@webview_devtools_remote_/ {
            name=$8
            if (name ~ ("(^|[^0-9])" pid "([^0-9]|$)")) {
              sub(/^@/, "", name)
              print name
              exit
            }
          }')"
    [[ -n "$SOCKET" ]] && break
  fi
  sleep 0.25
done

[[ "$PID" =~ ^[0-9]+$ ]] || fail "$PACKAGE process is not running after launch"
[[ -n "$SOCKET" ]] \
  || fail "WebView DevTools socket did not appear for PID $PID; ensure the installed APK is the debuggable current-source build"

PORT="$($ADB forward tcp:0 "localabstract:$SOCKET" 2>/dev/null || true)"
[[ "$PORT" =~ ^[0-9]+$ ]] \
  || fail "could not forward WebView DevTools socket $SOCKET"

cleanup() {
  $ADB forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

printf 'Package: %s\n' "$PACKAGE"
printf 'PID: %s\n' "$PID"
printf 'WebView DevTools socket: %s\n' "$SOCKET"
printf 'Forwarded DevTools port: %s\n' "$PORT"

node "$ROOT/tools/device-agc-smoke.js" "$PORT"
node "$ROOT/tools/device-v35-smoke.js" "$PORT"
node "$ROOT/tools/device-recreation-smoke.js" "$PORT"
