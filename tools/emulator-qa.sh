#!/usr/bin/env bash
set -euxo pipefail

mkdir -p qa/probe
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
adb shell settings put secure immersive_mode_confirmations confirmed || true
adb shell am force-stop com.google.android.apps.nexuslauncher || true
adb shell am force-stop com.android.launcher3 || true
adb shell am force-stop "$PKG" || true

adb shell dumpsys package com.android.webview > qa/webview-package.txt || true
adb shell dumpsys webviewupdate > qa/webview-update.txt || true

COMPONENT="$(adb shell cmd package resolve-activity --brief "$PKG" | tail -n 1 | tr -d '\r')"
printf '%s\n' "$COMPONENT" | tee qa/component.txt
test -n "$COMPONENT"
adb shell am start -W -n "$COMPONENT" | tee qa/start.txt

PID="$(adb shell pidof -s "$PKG" || true)"
printf '%s\n' "$PID" > qa/pid-initial.txt
test -n "$PID"

# Wait until the WebView has visibly painted something other than the exact
# activity background (#6F7571), with a hard ceiling.
READY=0
for i in $(seq 1 30); do
  adb exec-out screencap -p > qa/probe/ready.png
  if python3 - <<'PY'
from PIL import Image
im=Image.open('qa/probe/ready.png').convert('RGB')
lo,hi=im.getextrema()[0],im.getextrema()[0]
# Uniform activity background is exactly (111,117,113). Sample pixels sparsely.
px=im.load(); w,h=im.size
same=True
for y in range(0,h,max(1,h//30)):
  for x in range(0,w,max(1,w//20)):
    if px[x,y] != (111,117,113):
      same=False; break
  if not same: break
raise SystemExit(1 if same else 0)
PY
  then READY=1; break; fi
  sleep 1
done
printf '%s\n' "$READY" | tee qa/paint-ready.txt
test "$READY" = 1

adb shell wm size > qa/wm-size.txt
adb shell wm density > qa/wm-density.txt
adb shell dumpsys activity activities > qa/activity-before.txt
adb shell dumpsys SurfaceFlinger --list > qa/surface-list-before.txt || true
adb shell cat /proc/net/unix | grep -i webview > qa/webview-sockets.txt || true
adb exec-out screencap -p > qa/initial-painted.png

# Start screen recording in parallel so we can independently poll screencap and
# SurfaceFlinger during the same interval.
adb shell rm -f /sdcard/clock.mp4 || true
(timeout 20s adb shell screenrecord --bit-rate 4000000 --time-limit 12 /sdcard/clock.mp4 || true) &
REC_HOST_PID=$!

for i in $(seq -w 1 32); do
  date -u +%s.%N > "qa/probe/time-$i.txt"
  adb exec-out screencap -p > "qa/probe/frame-$i.png" || true
  adb shell dumpsys SurfaceFlinger --list > "qa/probe/surfaces-$i.txt" || true
  adb shell dumpsys window windows | grep -E "mCurrentFocus|mFocusedApp|org.apollo.agcdsky" > "qa/probe/window-$i.txt" || true
  sleep 0.20
done

wait "$REC_HOST_PID" || true
adb shell ls -l /sdcard/clock.mp4 | tee qa/clock-video-stat.txt
adb pull /sdcard/clock.mp4 qa/clock.mp4
adb exec-out screencap -p > qa/after-clock.png

sleep 3
PID2="$(adb shell pidof -s "$PKG" || true)"
printf '%s\n' "$PID2" > qa/pid-after-observation.txt
test -n "$PID2"

adb shell dumpsys activity activities > qa/activity-after.txt
adb shell dumpsys SurfaceFlinger --list > qa/surface-list-after.txt || true
capture_logs
trap - EXIT

if grep -E "FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process: .*has died" qa/app-logcat.txt qa/crash-logcat.txt; then
  echo "Crash signature detected" >&2
  exit 1
fi

printf 'EMULATOR QA PASS\n' | tee qa/result.txt
