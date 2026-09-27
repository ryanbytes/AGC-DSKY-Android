#!/usr/bin/env bash
set -euxo pipefail

mkdir -p qa/clock-stills
APK=app/build/outputs/apk/regular/debug/app-regular-debug.apk
PKG=org.apollo.agcdsky.eltest

capture_logs() {
  local pid
  pid="$(adb shell pidof -s "$PKG" 2>/dev/null || true)"
  printf '%s\n' "$pid" > qa/pid-final.txt
  adb logcat -d > qa/full-logcat.txt || true
  if [ -n "$pid" ]; then adb logcat --pid "$pid" -d > qa/app-logcat.txt || true; else cp qa/full-logcat.txt qa/app-logcat.txt; fi
  adb logcat -b crash -d > qa/crash-logcat.txt || true
  adb shell dumpsys meminfo "$PKG" > qa/meminfo.txt || true
  adb shell dumpsys gfxinfo "$PKG" > qa/gfxinfo.txt || true
}
trap capture_logs EXIT

test -f "$APK"
sha256sum "$APK" | tee qa/apk-sha256.txt
adb install -r "$APK" | tee qa/install.txt
adb logcat -c
adb shell settings put secure immersive_mode_confirmations confirmed || true
adb shell am force-stop com.google.android.apps.nexuslauncher || true
adb shell am force-stop com.android.launcher3 || true
adb shell am force-stop "$PKG" || true

adb shell dumpsys webviewupdate > qa/webview-update.txt || true
COMPONENT="$(adb shell cmd package resolve-activity --brief "$PKG" | tail -n 1 | tr -d '\r')"
printf '%s\n' "$COMPONENT" | tee qa/component.txt
test -n "$COMPONENT"
adb shell am start -W -n "$COMPONENT" | tee qa/start.txt

# Wait for both normal application startup and the QA oracle itself.
READY=0
for i in $(seq 1 45); do
  LOG="$(adb logcat -d || true)"
  if printf '%s\n' "$LOG" | grep -Fq "FRONTEND READY app" &&
     printf '%s\n' "$LOG" | grep -Fq "QA R3_PROBE_READY"; then
    READY=1
    break
  fi
  sleep 1
done
printf '%s\n' "$READY" | tee qa/frontend-and-probe-ready.txt
test "$READY" = 1

PID="$(adb shell pidof -s "$PKG" || true)"
printf '%s\n' "$PID" > qa/pid-initial.txt
test -n "$PID"

# Wait for an actually composed DSKY frame. Uniform-background/black captures
# from the old AOSP WebView are small PNGs; the rendered DSKY is much larger.
VISIBLE=0
for i in $(seq 1 45); do
  adb exec-out screencap -p > qa/visible-probe.png
  BYTES="$(stat -c%s qa/visible-probe.png)"
  printf '%s %s\n' "$i" "$BYTES" >> qa/visible-probe-sizes.txt
  if [ "$BYTES" -gt 100000 ]; then VISIBLE=1; break; fi
  sleep 1
done
printf '%s\n' "$VISIBLE" | tee qa/visible-ready.txt
test "$VISIBLE" = 1
cp qa/visible-probe.png qa/initial-visible.png

# Observe enough real second transitions to exercise relays 1/2/3 repeatedly.
for i in $(seq -w 1 20); do
  sleep 1
  adb exec-out screencap -p > "qa/clock-stills/frame-$i.png"
done

PID2="$(adb shell pidof -s "$PKG" || true)"
printf '%s\n' "$PID2" > qa/pid-after-observation.txt
test -n "$PID2"

capture_logs
trap - EXIT

grep -F "QA R3_" qa/full-logcat.txt > qa/r3-probe-log.txt || true
grep -Fq "QA R3_PROBE_READY" qa/r3-probe-log.txt
grep -Fq "QA R3_MATCH" qa/r3-probe-log.txt
if grep -Fq "QA R3_MISMATCH" qa/r3-probe-log.txt; then
  echo "R3 transient paint mismatch detected" >&2
  exit 1
fi

SUMMARY="$(grep -F "QA R3_SUMMARY" qa/r3-probe-log.txt | tail -n 1)"
printf '%s\n' "$SUMMARY" | tee qa/r3-final-summary.txt
PAINTS="$(printf '%s\n' "$SUMMARY" | sed -n 's/.*paints=\([0-9][0-9]*\).*/\1/p')"
MISMATCHES="$(printf '%s\n' "$SUMMARY" | sed -n 's/.*mismatches=\([0-9][0-9]*\).*/\1/p')"
CONTACTS="$(printf '%s\n' "$SUMMARY" | sed -n 's/.*relayContacts=\([0-9][0-9]*\).*/\1/p')"
printf 'paints=%s\nmismatches=%s\nrelayContacts=%s\n' "$PAINTS" "$MISMATCHES" "$CONTACTS" | tee qa/r3-counts.txt

test -n "$PAINTS"
test -n "$MISMATCHES"
test -n "$CONTACTS"
test "$PAINTS" -ge 5
test "$MISMATCHES" -eq 0
test "$CONTACTS" -ge 1

if grep -E "FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process: .*has died" qa/app-logcat.txt qa/crash-logcat.txt; then
  echo "Crash signature detected" >&2
  exit 1
fi

printf 'R3 CLOCK PAINT ORACLE PASS\n' | tee qa/result.txt
