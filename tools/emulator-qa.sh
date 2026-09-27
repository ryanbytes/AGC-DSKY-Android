#!/usr/bin/env bash
set -euxo pipefail

mkdir -p qa
APK=app/build/outputs/apk/regular/debug/app-regular-debug.apk
PKG=org.apollo.agcdsky.eltest

capture_logs() {
  local pid
  pid="$(adb shell pidof -s "$PKG" 2>/dev/null || true)"
  printf '%s\n' "$pid" > qa/pid-final.txt
  if [ -n "$pid" ]; then adb logcat --pid "$pid" -d > qa/app-logcat.txt || true; else adb logcat -d > qa/app-logcat.txt || true; fi
  adb logcat -b crash -d > qa/crash-logcat.txt || true
  adb shell dumpsys meminfo "$PKG" > qa/meminfo.txt || true
  adb shell dumpsys gfxinfo "$PKG" > qa/gfxinfo.txt || true
}
trap capture_logs EXIT

test -f "$APK"
sha256sum "$APK" | tee qa/apk-sha256.txt
adb install -r "$APK" | tee qa/install.txt
adb logcat -c
# Suppress Android's one-time immersive-mode tutorial so screenshots show only the app.
adb shell settings put secure immersive_mode_confirmations confirmed || true
# Clear any launcher state before starting the DSKY directly.
adb shell am force-stop com.google.android.apps.nexuslauncher || true
adb shell am force-stop com.android.launcher3 || true
adb shell am force-stop "$PKG" || true

COMPONENT="$(adb shell cmd package resolve-activity --brief "$PKG" | tail -n 1 | tr -d '\r')"
printf '%s\n' "$COMPONENT" | tee qa/component.txt
test -n "$COMPONENT"
adb shell am start -W -n "$COMPONENT" | tee qa/start.txt
sleep 10

PID="$(adb shell pidof -s "$PKG" || true)"
printf '%s\n' "$PID" > qa/pid-initial.txt
test -n "$PID"

adb shell wm size > qa/wm-size.txt
adb shell wm density > qa/wm-density.txt
adb shell dumpsys activity activities > qa/activity.txt
adb exec-out screencap -p > qa/initial.png

# Capture several stills across clock-second transitions.
for i in 1 2 3 4 5; do
  sleep 1
  adb exec-out screencap -p > "qa/clock-$i.png"
done

# Record PHONE CLOCK with a host-side guard so screenrecord cannot hang the run.
adb shell rm -f /sdcard/clock.mp4 || true
timeout 20s adb shell screenrecord --bit-rate 4000000 --time-limit 12 /sdcard/clock.mp4 || true
adb shell ls -l /sdcard/clock.mp4 | tee qa/clock-video-stat.txt
adb pull /sdcard/clock.mp4 qa/clock.mp4
adb exec-out screencap -p > qa/after-clock.png

# Prove the process stays alive after the observation window.
sleep 5
PID2="$(adb shell pidof -s "$PKG" || true)"
printf '%s\n' "$PID2" > qa/pid-after-observation.txt
test -n "$PID2"

capture_logs
trap - EXIT

if grep -E "FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process: .*has died" qa/app-logcat.txt qa/crash-logcat.txt; then
  echo "Crash signature detected" >&2
  exit 1
fi

printf 'EMULATOR QA PASS\n' | tee qa/result.txt
