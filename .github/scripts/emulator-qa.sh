#!/usr/bin/env bash
set -euo pipefail

OUT="$RUNNER_TEMP/dsky-emulator-qa"
mkdir -p "$OUT"
APK="$RUNNER_TEMP/AGC-DSKY-emulator-qa.apk"
PKG="org.apollo.agcdsky"

cat > "$OUT/tap_text.py" <<'PY'
import re, sys, xml.etree.ElementTree as ET
xml_path, wanted = sys.argv[1], sys.argv[2].upper()
data=open(xml_path,'r',encoding='utf-8',errors='ignore').read()
start=data.find('<?xml')
end=data.rfind('</hierarchy>')
if start >= 0:
    data=data[start:]
if end >= 0:
    # Recompute because start slicing may have shifted offsets.
    end=data.rfind('</hierarchy>')
    data=data[:end+len('</hierarchy>')]
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

dump_ui_to() {
  local path="$1"
  adb exec-out uiautomator dump /dev/tty > "$path" || true
}

tap_from_dump() {
  local dump="$1"
  local label="$2"
  local xy
  if xy="$(python3 "$OUT/tap_text.py" "$dump" "$label" 2>/dev/null)"; then
    local x y
    read -r x y <<<"$xy"
    adb shell input tap "$x" "$y"
    sleep 0.8
    printf 'TAPPED:%s:%s,%s\n' "$label" "$x" "$y" | tee -a "$OUT/interaction.txt"
    return 0
  fi
  return 1
}

dump_ui() {
  dump_ui_to "$OUT/current.xml"
}

tap_label() {
  local label="$1"
  dump_ui
  if tap_from_dump "$OUT/current.xml" "$label"; then
    return 0
  fi
  echo "MISSING_UI_NODE:$label" | tee -a "$OUT/interaction.txt"
  return 1
}

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

# Preserve evidence of the first-launch Android immersive-mode education overlay.
adb exec-out screencap -p > "$OUT/00-before-system-dismiss.png"
dump_ui_to "$OUT/00-before-system-dismiss.xml"

if tap_from_dump "$OUT/00-before-system-dismiss.xml" "Got it"; then
  echo "SYSTEM_FULLSCREEN_OVERLAY_DISMISSED" | tee -a "$OUT/interaction.txt"
  sleep 1
else
  echo "NO_SYSTEM_FULLSCREEN_OVERLAY" | tee -a "$OUT/interaction.txt"
fi

adb exec-out screencap -p > "$OUT/01-launch.png"
dump_ui_to "$OUT/01-launch.xml"

python3 - <<'PY' > "$OUT/ui-nodes.txt"
import xml.etree.ElementTree as ET, os
p=os.environ['RUNNER_TEMP']+'/dsky-emulator-qa/01-launch.xml'
data=open(p,'r',encoding='utf-8',errors='ignore').read()
start=data.find('<?xml')
if start >= 0:
    data=data[start:]
end=data.rfind('</hierarchy>')
if end >= 0:
    data=data[:end+len('</hierarchy>')]
try:
    root=ET.fromstring(data)
    for n in root.iter('node'):
        text=(n.attrib.get('text') or '').strip()
        desc=(n.attrib.get('content-desc') or '').strip()
        bounds=n.attrib.get('bounds','')
        clickable=n.attrib.get('clickable','')
        if text or desc:
            print(f"text={text!r} desc={desc!r} bounds={bounds} clickable={clickable}")
except Exception as e:
    print("UI_PARSE_ERROR", repr(e))
PY

INTERACTION=0
if tap_label VERB; then
  adb exec-out screencap -p > "$OUT/02-after-verb.png"
  tap_label 3 || INTERACTION=1
  tap_label 5 || INTERACTION=1
  tap_label ENTR || INTERACTION=1
else
  INTERACTION=1
fi

sleep 3
adb exec-out screencap -p > "$OUT/03-after-v35.png"
dump_ui_to "$OUT/03-after-v35.xml"
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
  echo "APP_LAUNCHED_BUT_DSKY_KEYS_NOT_EXPOSED_TO_UIAUTOMATOR" | tee -a "$OUT/result.txt"
fi
