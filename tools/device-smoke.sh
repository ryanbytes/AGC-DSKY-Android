#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGE=org.apollo.agcdsky
ACTIVITY="$PACKAGE/.MainActivity"
APK="${1:-$ROOT/app/build/outputs/apk/debug/app-debug.apk}"
LOG_DIR="$ROOT/app/build/device-smoke"

fail() {
  printf 'DEVICE SMOKE FAIL: %s\n' "$*" >&2
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

ADB="$(find_adb || true)"
[[ -n "$ADB" ]] || fail "adb not found; install Android SDK Platform Tools or set ANDROID_SDK_ROOT"
[[ -f "$APK" ]] || fail "APK not found: $APK"

DEVICE_COUNT="$($ADB devices | awk 'NR>1 && $2=="device" {n++} END {print n+0}')"
[[ "$DEVICE_COUNT" == "1" ]] \
  || fail "expected exactly one authorized ADB device; found $DEVICE_COUNT"

mkdir -p "$LOG_DIR"
rm -f "$LOG_DIR/logcat.txt" "$LOG_DIR/debug-last.txt"

printf 'Installing: %s\n' "$APK"
INSTALL_OUTPUT="$($ADB install -r "$APK" 2>&1)" || {
  printf '%s\n' "$INSTALL_OUTPUT" >&2
  if grep -Fq 'INSTALL_FAILED_UPDATE_INCOMPATIBLE' <<<"$INSTALL_OUTPUT"; then
    fail "installed AGC DSKY uses a different signing key. This script will not uninstall it automatically because that would erase app state."
  fi
  fail "adb install failed"
}
printf '%s\n' "$INSTALL_OUTPUT"

$ADB logcat -c >/dev/null 2>&1 || true
$ADB shell am force-stop "$PACKAGE" >/dev/null

printf 'Launching %s\n' "$ACTIVITY"
START_OUTPUT="$($ADB shell am start -W -n "$ACTIVITY" 2>&1)" || {
  printf '%s\n' "$START_OUTPUT" >&2
  fail "Activity launch failed"
}
printf '%s\n' "$START_OUTPUT"

sleep 2
PID="$($ADB shell pidof -s "$PACKAGE" 2>/dev/null | tr -d '\r' || true)"
[[ -n "$PID" ]] || fail "app process is not running after launch"
printf 'Process: %s (pid %s)\n' "$PACKAGE" "$PID"

if ! $ADB logcat -d -v threadtime --pid="$PID" > "$LOG_DIR/logcat.txt" 2>/dev/null; then
  # Older adb/logcat combinations may not support --pid. Keep a useful fallback.
  $ADB logcat -d -v threadtime > "$LOG_DIR/logcat.txt" 2>/dev/null || true
fi

# Debug builds are debuggable, so run-as can inspect the app-private local crash
# report without adding storage/export permissions to the application itself.
if $ADB shell run-as "$PACKAGE" test -s files/debug-last.txt >/dev/null 2>&1; then
  $ADB exec-out run-as "$PACKAGE" cat files/debug-last.txt > "$LOG_DIR/debug-last.txt" 2>/dev/null || true
fi

if [[ -s "$LOG_DIR/debug-last.txt" ]]; then
  printf '\nApp-local debug report was produced:\n' >&2
  cat "$LOG_DIR/debug-last.txt" >&2
  printf '\nSaved to: %s\n' "$LOG_DIR/debug-last.txt" >&2
  exit 1
fi

if grep -Eiq 'FATAL EXCEPTION|AndroidRuntime.*FATAL|Process: org\.apollo\.agcdsky.*has died|crash_dump.*org\.apollo\.agcdsky' "$LOG_DIR/logcat.txt"; then
  printf '\nPotential fatal event found in logcat:\n' >&2
  grep -Ei 'FATAL EXCEPTION|AndroidRuntime|org\.apollo\.agcdsky|crash_dump' "$LOG_DIR/logcat.txt" | tail -n 120 >&2 || true
  printf '\nFull log: %s\n' "$LOG_DIR/logcat.txt" >&2
  exit 1
fi

printf 'Immediate device smoke: PASS\n'
printf '  process stayed alive after launch\n'
printf '  no app-local debug report was produced\n'
printf '  no obvious fatal event was found in captured logcat\n'
printf '  log: %s\n' "$LOG_DIR/logcat.txt"
printf '\nManual gates still required: enter AGC mode, exercise DSKY keys/PRO, switch LM/CM, screen off/on, and test DreamService/SOLAR.\n'
