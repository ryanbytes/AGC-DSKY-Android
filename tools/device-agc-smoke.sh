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
# inspection only when FLAG_DEBUGGABLE is present, so a release build should
# fail later with a clear missing-DevTools-socket message.
$ADB shell am start -W -n "$ACTIVITY" >/dev/null 2>&1 \
  || fail "could not launch $ACTIVITY"
sleep 1

PID="$($ADB shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' | awk '{print $1}')"
[[ "$PID" =~ ^[0-9]+$ ]] || fail "$PACKAGE process is not running after launch"

SOCKET="$($ADB shell cat /proc/net/unix 2>/dev/null \
  | tr -d '\r' \
  | awk -v pid="$PID" '$8 ~ /^@webview_devtools_remote_/ && $8 ~ pid {sub(/^@/, "", $8); print $8; exit}')"
if [[ -z "$SOCKET" ]]; then
  SOCKET="webview_devtools_remote_$PID"
fi

PORT="$($ADB forward tcp:0 "localabstract:$SOCKET" 2>/dev/null || true)"
[[ "$PORT" =~ ^[0-9]+$ ]] \
  || fail "could not forward WebView DevTools socket $SOCKET; ensure the installed APK is debuggable"

cleanup() {
  $ADB forward --remove "tcp:$PORT" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

printf 'Package: %s\n' "$PACKAGE"
printf 'PID: %s\n' "$PID"
printf 'WebView DevTools socket: %s\n' "$SOCKET"
printf 'Forwarded DevTools port: %s\n' "$PORT"

node "$ROOT/tools/device-agc-smoke.js" "$PORT"
