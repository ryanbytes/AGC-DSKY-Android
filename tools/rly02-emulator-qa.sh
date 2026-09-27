#!/usr/bin/env bash
set -euxo pipefail

mkdir -p qa
APK=app/build/outputs/apk/regular/debug/app-regular-debug.apk
PKG=org.apollo.agcdsky.eltest

capture_logs() {
  local pid
  pid="$(adb shell pidof -s "$PKG" 2>/dev/null || true)"
  printf '%s\n' "$pid" > qa/pid-final.txt
  adb logcat -d > qa/full-logcat.txt || true
  if [ -n "$pid" ]; then adb logcat --pid "$pid" -d > qa/app-logcat.txt || true; else cp qa/full-logcat.txt qa/app-logcat.txt; fi
  adb logcat -b crash -d > qa/crash-logcat.txt || true
}
trap capture_logs EXIT

test -f "$APK"
sha256sum "$APK" | tee qa/apk-sha256.txt
adb install -r "$APK" | tee qa/install.txt
adb logcat -c
COMPONENT="$(adb shell cmd package resolve-activity --brief "$PKG" | tail -n 1 | tr -d '\r')"
printf '%s\n' "$COMPONENT" | tee qa/component.txt
test -n "$COMPONENT"
adb shell am force-stop "$PKG" || true
adb shell am start -n "$COMPONENT" | tee qa/start.txt

PASS=0
for i in $(seq 1 120); do
  LOG="$(adb logcat -d || true)"
  if printf '%s\n' "$LOG" | grep -Fq "QA RLY02_FAIL"; then
    printf '%s\n' "$LOG" | grep -F "QA RLY02_" | tee qa/rly02-probe-log.txt
    echo "RLY02 runtime oracle reported failure" >&2
    exit 1
  fi
  if printf '%s\n' "$LOG" | grep -Fq "QA RLY02_PASS"; then
    PASS=1
    break
  fi
  sleep 1
done

capture_logs
trap - EXIT
grep -F "QA RLY02_" qa/full-logcat.txt | tee qa/rly02-probe-log.txt
test "$PASS" = 1
grep -Fq "QA RLY02_PASS" qa/rly02-probe-log.txt
if grep -Fq "QA RLY02_FAIL" qa/rly02-probe-log.txt; then
  echo "RLY02 runtime oracle reported failure" >&2
  exit 1
fi
if grep -E "FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process: .*has died" qa/app-logcat.txt qa/crash-logcat.txt; then
  echo "Crash signature detected" >&2
  exit 1
fi
printf 'RLY02 PACKAGED WEBVIEW ORACLE PASS\n' | tee qa/result.txt
