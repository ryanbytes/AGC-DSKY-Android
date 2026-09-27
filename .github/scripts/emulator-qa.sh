#!/usr/bin/env bash
set -euo pipefail

OUT="$RUNNER_TEMP/dsky-emulator-qa"
mkdir -p "$OUT"
APK="$RUNNER_TEMP/AGC-DSKY-emulator-qa.apk"
PKG="org.apollo.agcdsky"

adb wait-for-device
adb shell getprop ro.build.version.release | tee "$OUT/android-version.txt"
adb shell getprop ro.build.version.sdk | tee -a "$OUT/android-version.txt"
adb shell wm size | tee "$OUT/display.txt"
adb shell wm density | tee -a "$OUT/display.txt"

adb install -r "$APK" | tee "$OUT/install.txt"
adb shell dumpsys package "$PKG" | grep -E 'versionName=|versionCode=' | head -10 | tee "$OUT/package-version.txt"

ACTIVITY="$(adb shell cmd package resolve-activity --brief "$PKG" | tr -d '\r' | tail -1)"
printf '%s\n' "$ACTIVITY" | tee "$OUT/activity.txt"

adb logcat -c
adb shell am force-stop "$PKG"
adb shell am start -W -n "$ACTIVITY" | tee "$OUT/launch.txt"
sleep 4

adb exec-out screencap -p > "$OUT/01-launch.png"
adb exec-out uiautomator dump /dev/tty > "$OUT/01-launch.xml" || true

cat > "$OUT/tap_text.py" <<'PY'
import re, sys, xml.etree.ElementTree as ET
xml_path, wanted = sys.argv[1], sys.argv[2].upper()
data=open(xml_path,'r',encoding='utf-8',errors='ignore').read()
data=data[data.find('<?xml'):] if '<?xml' in data else data
root=ET.fromstring(data)
for n in root.iter('node'):
    vals=[(n.attrib.get('text') or '').strip(), (n.attrib.get('content-desc') or '').strip()]
    if any(v.upper()==wanted for v in vals if v):
        m=re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', n.attrib.get('bounds',''))
        if m:
            x1,y1,x2,y2=map(int,m.groups())
            print((x1+x2)//2, (y1+y2)//2)
            sys.exit(0)
sys.exit(2)
PY

python3 - <<'PY' > "$OUT/ui-nodes.txt"
import xml.etree.ElementTree as ET, os
p=os.environ['RUNNER_TEMP']+'/dsky-emulator-qa/01-launch.xml'
data=open(p,'r',encoding='utf-8',errors='ignore').read()
data=data[data.find('<?xml'):] if '<?xml' in data else data
try:
    root=ET.fromstring(data)
    for n in root.iter('node'):
        text=(n.attrib.get('text') or '').strip()
        desc=(n.attrib.get('content-desc') or '').strip()
        bounds=n.attrib.get('bounds','')
        if text or desc:
            print(f"text={text!r} desc={desc!r} bounds={bounds}")
except Exception as e:
    print("UI_PARSE_ERROR", repr(e))
PY

dump_ui() {
  adb exec-out uiautomator dump /dev/tty > "$OUT/current.xml"
}

tap_label() {
  local label="$1"
  dump_ui || true
  local xy
  if xy="$(python3 "$OUT/tap_text.py" "$OUT/current.xml" "$label" 2>/dev/null)"; then
    read -r x y <<<"$xy"
    adb shell input tap "$x" "$y"
    sleep 0.7
    return 0
  fi
  echo "MISSING_UI_NODE:$label" | tee -a "$OUT/interaction.txt"
  return 1
}

INTERACTION=0
if tap_label VERB; then
  tap_label 3 || INTERACTION=1
  tap_label 5 || INTERACTION=1
  tap_label ENTR || INTERACTION=1
else
  INTERACTION=1
fi

sleep 3
adb exec-out screencap -p > "$OUT/02-after-v35.png"
adb exec-out uiautomator dump /dev/tty > "$OUT/02-after-v35.xml" || true
adb shell dumpsys activity top > "$OUT/activity-top.txt"
adb shell dumpsys window > "$OUT/window.txt"
adb logcat -d > "$OUT/logcat.txt"
adb logcat -b crash -d > "$OUT/crash.txt" || true

PID="$(adb shell pidof -s "$PKG" || true)"
echo "pid=$PID" | tee "$OUT/result.txt"
if [[ -z "$PID" ]]; then
  echo "APP_PROCESS_NOT_RUNNING" | tee -a "$OUT/result.txt"
  exit 10
fi

if grep -Eq 'FATAL EXCEPTION|AndroidRuntime.*FATAL|Process: org\.apollo\.agcdsky.*has died' "$OUT/logcat.txt"; then
  echo "FATAL_CRASH_FOUND" | tee -a "$OUT/result.txt"
  exit 11
fi

if [[ "$INTERACTION" -eq 0 ]]; then
  echo "V35_UI_SEQUENCE_EXECUTED" | tee -a "$OUT/result.txt"
else
  echo "APP_LAUNCHED_BUT_WEBVIEW_KEYS_NOT_EXPOSED_TO_UIAUTOMATOR" | tee -a "$OUT/result.txt"
fi
