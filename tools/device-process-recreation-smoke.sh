#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE=org.apollo.agcdsky
ACTIVITY="$PACKAGE/.SensorMainActivity"

fail() {
  printf 'DEVICE PROCESS RECREATION SMOKE FAIL: %s\n' "$*" >&2
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

find_process_socket() {
  local pid=""
  local socket=""
  for _ in {1..60}; do
    pid="$($ADB shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' | awk '{print $1}')"
    if [[ "$pid" =~ ^[0-9]+$ ]]; then
      socket="$($ADB shell cat /proc/net/unix 2>/dev/null \
        | tr -d '\r' \
        | awk -v pid="$pid" '
            $8 ~ /^@webview_devtools_remote_/ {
              name=$8
              if (name ~ ("(^|[^0-9])" pid "([^0-9]|$)")) {
                sub(/^@/, "", name)
                print name
                exit
              }
            }')"
      if [[ -n "$socket" ]]; then
        printf '%s %s\n' "$pid" "$socket"
        return 0
      fi
    fi
    sleep 0.25
  done
  return 1
}

forward_socket() {
  local socket="$1"
  local port
  port="$($ADB forward tcp:0 "localabstract:$socket" 2>/dev/null || true)"
  [[ "$port" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "$port"
}

remove_forward() {
  local port="$1"
  [[ "$port" =~ ^[0-9]+$ ]] || return 0
  $ADB forward --remove "tcp:$port" >/dev/null 2>&1 || true
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

OLD_PORT=""
NEW_PORT=""
RESTORE_NEEDED=0

cleanup() {
  remove_forward "${OLD_PORT:-}"
  remove_forward "${NEW_PORT:-}"

  if [[ "${RESTORE_NEEDED:-0}" == "1" ]]; then
    # Best-effort recovery: the prepare phase may have persisted temporary
    # smoke markers and switched the app into CM/AGC mode before a later ADB or
    # DevTools step failed. Relaunch and ask the helper to restore the user's
    # original mission/run-mode preferences whenever possible.
    $ADB shell am start -W -n "$ACTIVITY" >/dev/null 2>&1 || true
    local recovery_pid="" recovery_socket="" recovery_port=""
    read -r recovery_pid recovery_socket < <(find_process_socket || true)
    if [[ "$recovery_pid" =~ ^[0-9]+$ && -n "$recovery_socket" ]]; then
      recovery_port="$(forward_socket "$recovery_socket" || true)"
      if [[ "$recovery_port" =~ ^[0-9]+$ ]]; then
        node "$ROOT/tools/device-process-state-smoke.js" "$recovery_port" restore >/dev/null 2>&1 || true
        remove_forward "$recovery_port"
      fi
    fi
  fi
}
trap cleanup EXIT INT TERM

$ADB shell am start -W -n "$ACTIVITY" >/dev/null 2>&1 \
  || fail "could not launch $ACTIVITY before process recreation"

read -r OLD_PID OLD_SOCKET < <(find_process_socket || true)
[[ "$OLD_PID" =~ ^[0-9]+$ && -n "$OLD_SOCKET" ]] \
  || fail "could not find initial app process/WebView DevTools socket"

OLD_PORT="$(forward_socket "$OLD_SOCKET" || true)"
[[ "$OLD_PORT" =~ ^[0-9]+$ ]] || fail "could not forward initial WebView DevTools socket"

# Set this before prepare so even a partially completed prepare gets cleanup.
RESTORE_NEEDED=1
node "$ROOT/tools/device-process-state-smoke.js" "$OLD_PORT" prepare
remove_forward "$OLD_PORT"
OLD_PORT=""

$ADB shell am force-stop "$PACKAGE" >/dev/null 2>&1 \
  || fail "adb force-stop failed"

PROCESS_GONE=0
for _ in {1..20}; do
  PID_AFTER_STOP="$($ADB shell pidof "$PACKAGE" 2>/dev/null | tr -d '\r' | awk '{print $1}')"
  if [[ -z "$PID_AFTER_STOP" ]]; then
    PROCESS_GONE=1
    break
  fi
  sleep 0.25
done
[[ "$PROCESS_GONE" == "1" ]] \
  || fail "app process did not disappear after force-stop"

$ADB shell am start -W -n "$ACTIVITY" >/dev/null 2>&1 \
  || fail "could not relaunch $ACTIVITY after force-stop"

read -r NEW_PID NEW_SOCKET < <(find_process_socket || true)
[[ "$NEW_PID" =~ ^[0-9]+$ && -n "$NEW_SOCKET" ]] \
  || fail "could not find relaunched app process/WebView DevTools socket"

NEW_PORT="$(forward_socket "$NEW_SOCKET" || true)"
[[ "$NEW_PORT" =~ ^[0-9]+$ ]] || fail "could not forward relaunched WebView DevTools socket"

node "$ROOT/tools/device-process-state-smoke.js" "$NEW_PORT" verify \
  || fail "recreated process did not restore persisted CM/AGC state"

# verify restores the user's pre-smoke preferences and removes temporary keys.
RESTORE_NEEDED=0

printf 'Device process recreation: PASS\n'
printf '  old PID: %s\n' "$OLD_PID"
printf '  process absent after force-stop: yes\n'
printf '  new PID: %s\n' "$NEW_PID"
printf '  persisted mission/run-mode restoration: PASS\n'
printf '  fresh Android process + fresh yaAGC core: PASS\n'
