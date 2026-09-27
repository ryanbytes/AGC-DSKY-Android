#!/usr/bin/env bash
set -euxo pipefail

mkdir -p qa
APK=app/build/outputs/apk/regular/debug/app-regular-debug.apk
PKG=org.apollo.agcdsky.eltest

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
adb shell uiautomator dump /sdcard/ui-initial.xml
adb pull /sdcard/ui-initial.xml qa/ui-initial.xml
adb exec-out screencap -p > qa/initial.png

# Record PHONE CLOCK across multiple second transitions. This is the visual evidence
# for the R3 transient/flicker regression while the relay model continues to run.
adb shell screenrecord --bit-rate 4000000 --time-limit 12 /sdcard/clock.mp4
adb pull /sdcard/clock.mp4 qa/clock.mp4
adb exec-out screencap -p > qa/after-clock.png
adb shell uiautomator dump /sdcard/ui-after-clock.xml
adb pull /sdcard/ui-after-clock.xml qa/ui-after-clock.xml

# Long-press the panel to expose controls.
adb shell input swipe 540 1000 540 1000 900
sleep 2
adb shell uiautomator dump /sdcard/ui-controls.xml
adb pull /sdcard/ui-controls.xml qa/ui-controls.xml
adb exec-out screencap -p > qa/controls.png

# Tap MODE if Android exposes the WebView control through accessibility.
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
adb shell uiautomator dump /sdcard/ui-after-mode.xml
adb pull /sdcard/ui-after-mode.xml qa/ui-after-mode.xml
adb exec-out screencap -p > qa/after-mode.png

PID="$(adb shell pidof -s "$PKG" || true)"
printf '%s\n' "$PID" > qa/pid-final.txt
test -n "$PID"
adb logcat --pid "$PID" -d > qa/app-logcat.txt
adb logcat -b crash -d > qa/crash-logcat.txt || true
adb shell dumpsys meminfo "$PKG" > qa/meminfo.txt || true

if grep -E "FATAL EXCEPTION|AndroidRuntime:.*FATAL|Process: .*has died" qa/app-logcat.txt qa/crash-logcat.txt; then
  echo "Crash signature detected" >&2
  exit 1
fi

printf 'EMULATOR QA PASS\n' | tee qa/result.txt
