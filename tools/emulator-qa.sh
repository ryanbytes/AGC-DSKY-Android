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
}
trap capture_logs EXIT

dump_ui() {
  local base="$1"
  local remote="/sdcard/$base.xml"
  local log="qa/$base-dump.txt"
  rm -f "$log"
  adb shell rm -f "$remote" || true
  adb shell uiautomator dump "$remote" >"$log" 2>&1 || true
  if ! adb shell test -f "$remote"; then
    sleep 2
    adb shell input keyevent KEYCODE_WAKEUP || true
    adb shell input keyevent 82 || true
    adb shell uiautomator dump "$remote" >>"$log" 2>&1 || true
  fi
  if adb shell test -f "$remote"; then
    adb pull "$remote" "qa/$base.xml"
    return 0
  fi
  printf 'UI TREE UNAVAILABLE\n' > "qa/$base.unavailable.txt"
  return 1
}

test -f "$APK"
adb install -r "$APK" | tee qa/install.txt
adb logcat -c
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

# Visual evidence first so accessibility-tree limitations cannot abort the test.
adb exec-out screencap -p > qa/initial.png
dump_ui ui-initial || true

# Record PHONE CLOCK across multiple second transitions.
adb shell screenrecord --bit-rate 4000000 --time-limit 12 /sdcard/clock.mp4
adb pull /sdcard/clock.mp4 qa/clock.mp4
adb exec-out screencap -p > qa/after-clock.png
dump_ui ui-after-clock || true

# Only drive controls when accessibility gives us coordinates.
if [ -f qa/ui-initial.xml ]; then
  python3 - <<'PY' > qa/dsky-coordinate.txt
import re
xml=open('qa/ui-initial.xml',encoding='utf-8').read()
for m in re.finditer(r'<node\b[^>]*>', xml):
    node=m.group(0)
    if 'APOLLO BLOCK II DSKY' not in node.upper():
        continue
    b=re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',node)
    if b:
        x1,y1,x2,y2=map(int,b.groups())
        print((x1+x2)//2,(y1+y2)//2)
        break
PY
fi

if [ -s qa/dsky-coordinate.txt ]; then
  read X Y < qa/dsky-coordinate.txt
  adb shell input swipe "$X" "$Y" "$X" "$Y" 900
  sleep 2
  adb exec-out screencap -p > qa/controls.png
  dump_ui ui-controls || true

  if [ -f qa/ui-controls.xml ]; then
    python3 - <<'PY'
import re, subprocess
xml=open('qa/ui-controls.xml',encoding='utf-8').read()
candidates=[]
for m in re.finditer(r'<node\b[^>]*>', xml):
    node=m.group(0)
    if 'MODE' not in node.upper():
        continue
    b=re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',node)
    if b:
        x1,y1,x2,y2=map(int,b.groups())
        candidates.append(((x1+x2)//2,(y1+y2)//2,node))
open('qa/mode-node.txt','w',encoding='utf-8').write('\n'.join(x[2] for x in candidates) or 'MODE NODE NOT FOUND\n')
if candidates:
    x,y,_=candidates[0]
    subprocess.check_call(['adb','shell','input','tap',str(x),str(y)])
PY
    sleep 15
    adb exec-out screencap -p > qa/after-mode.png
    dump_ui ui-after-mode || true
  fi
else
  printf 'ACCESSIBILITY TREE DID NOT PROVIDE DSKY COORDINATES; CONTROL INTERACTION SKIPPED\n' > qa/control-interaction-skipped.txt
fi

PID="$(adb shell pidof -s "$PKG" || true)"
test -n "$PID"
capture_logs
trap - EXIT

if grep -E "FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process: .*has died" qa/app-logcat.txt qa/crash-logcat.txt; then
  echo "Crash signature detected" >&2
  exit 1
fi

printf 'EMULATOR QA PASS\n' | tee qa/result.txt
