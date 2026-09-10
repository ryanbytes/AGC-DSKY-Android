#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-$ROOT/app/build/outputs/apk/fire/debug/app-fire-debug.apk}"
PACKAGE=org.apollo.agcdsky
DSKY_HOME="$PACKAGE/.SensorMainActivity"
FIRE_LAUNCHER_PACKAGE=com.amazon.firelauncher
FIRE_LAUNCHER_HOME="$FIRE_LAUNCHER_PACKAGE/.Launcher"
FIRE_MODE="$PACKAGE/.FireModeActivity"
FIRE_RECEIVER="$PACKAGE/.FireBootReceiver"
FIRE_SERVICE_FULL="$PACKAGE/$PACKAGE.FireRedirectAccessibilityService"
FIRE_SERVICE_SHORT="$PACKAGE/.FireRedirectAccessibilityService"
USER_ID=0
launcher_safety_required=false

fail() {
  printf 'FIRE HOME SETUP FAIL: %s\n' "$*" >&2
  return 1
}

recover_launcher() {
  local status="$1"
  local line="$2"
  trap - ERR INT TERM
  set +e
  printf 'Setup failed at line %s (status %s).\n' "$line" "$status" >&2
  if [[ "$launcher_safety_required" == true ]]; then
    printf 'Restoring Amazon Fire Launcher as the safe HOME fallback...\n' >&2
    "${ADB[@]}" wait-for-device >/dev/null 2>&1
    "${ADB[@]}" shell am start -a "$PACKAGE.FIRE_DISABLE" -n "$FIRE_MODE" >/dev/null 2>&1
    "${ADB[@]}" shell pm enable --user "$USER_ID" "$FIRE_LAUNCHER_PACKAGE" >/dev/null 2>&1 \
      || "${ADB[@]}" shell pm enable "$FIRE_LAUNCHER_PACKAGE" >/dev/null 2>&1
    "${ADB[@]}" shell cmd package set-home-activity --user "$USER_ID" "$FIRE_LAUNCHER_HOME" >/dev/null 2>&1
    "${ADB[@]}" shell input keyevent KEYCODE_HOME >/dev/null 2>&1
    printf 'Amazon Fire Launcher re-enabled.\n' >&2
  fi
  exit "$status"
}

trap 'recover_launcher $? $LINENO' ERR
trap 'recover_launcher 130 $LINENO' INT
trap 'recover_launcher 143 $LINENO' TERM

command -v adb >/dev/null 2>&1 || fail "adb is not installed or not on PATH"
[[ -f "$APK" ]] || fail "APK not found: $APK"

device_count="$(adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')"
[[ "$device_count" == 1 ]] || fail "connect exactly one authorized Android device; found $device_count"
device="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
ADB=(adb -s "$device")

manufacturer="$("${ADB[@]}" shell getprop ro.product.manufacturer | tr -d '\r')"
model="$("${ADB[@]}" shell getprop ro.product.model | tr -d '\r')"
fire_version="$("${ADB[@]}" shell getprop ro.build.version.name | tr -d '\r')"
manufacturer_lower="$(printf '%s' "$manufacturer" | tr '[:upper:]' '[:lower:]')"
[[ "$manufacturer_lower" == amazon ]] \
  || fail "target is not an Amazon device (manufacturer: ${manufacturer:-unknown})"

printf 'Device: %s %s (%s)\n' "$manufacturer" "$model" "$fire_version"
printf 'Installing: %s\n' "$APK"
"${ADB[@]}" install -r "$APK"

"${ADB[@]}" shell pm path "$PACKAGE" | grep -Fq 'package:' \
  || fail "$PACKAGE is not installed after adb install"
package_dump="$("${ADB[@]}" shell dumpsys package "$PACKAGE" | tr -d '\r')"
for component in FireModeActivity FireRedirectAccessibilityService FireBootReceiver; do
  grep -Fq "$component" <<<"$package_dump" \
    || fail "installed APK is not the Fire variant; missing $component"
done

# Preserve ordinary app launching and prove the dedicated HOME registration
# exists before changing or disabling the only known working launcher.
launcher_candidates="$("${ADB[@]}" shell cmd package query-activities --brief --user "$USER_ID" \
  -a android.intent.action.MAIN -c android.intent.category.LAUNCHER | tr -d '\r')"
grep -Fq "$DSKY_HOME" <<<"$launcher_candidates" \
  || fail "$DSKY_HOME is not registered for MAIN/LAUNCHER"

home_candidates="$("${ADB[@]}" shell cmd package query-activities --brief --user "$USER_ID" \
  -a android.intent.action.MAIN -c android.intent.category.HOME | tr -d '\r')"
grep -Fq "$DSKY_HOME" <<<"$home_candidates" \
  || fail "$DSKY_HOME is not registered for MAIN/HOME/DEFAULT; Amazon launcher was not changed"
printf 'DSKY launcher and HOME registrations: PASS\n'

printf 'Launching DSKY once before HOME assignment...\n'
launch_output="$("${ADB[@]}" shell am start -W -n "$DSKY_HOME" | tr -d '\r')"
grep -Fq "Activity: $DSKY_HOME" <<<"$launch_output" \
  || fail "explicit launch did not resolve to $DSKY_HOME"

set_home_output="$("${ADB[@]}" shell cmd package set-home-activity --user "$USER_ID" "$DSKY_HOME" 2>&1 | tr -d '\r')"
grep -Fq 'Success' <<<"$set_home_output" \
  || fail "set-home-activity did not report success: $set_home_output"

# Fire OS 7 keeps Amazon's HOME filter at priority 50, ahead of a normal app's
# priority 0, even after recording the preferred DSKY activity. Candidate and
# assignment checks above are therefore the positive pre-disable safety gate.
launcher_safety_required=true
home_path=native
disabled_packages="$("${ADB[@]}" shell pm list packages -d --user "$USER_ID" | tr -d '\r')"
if ! grep -Fxq "package:$FIRE_LAUNCHER_PACKAGE" <<<"$disabled_packages"; then
  printf 'Disabling Amazon Fire Launcher only after verified DSKY HOME registration...\n'
  if ! "${ADB[@]}" shell pm disable-user --user "$USER_ID" "$FIRE_LAUNCHER_PACKAGE" >/dev/null 2>&1; then
    home_path=protected-fire-redirect
    printf 'Fire OS protects Amazon Launcher; enabling the restored same-package Fire redirect.\n'
  fi
fi

resolve_home() {
  "${ADB[@]}" shell cmd package resolve-activity --brief --user "$USER_ID" \
    -a android.intent.action.MAIN -c android.intent.category.HOME \
    | tr -d '\r' | tail -n 1
}

resolved="$(resolve_home)"
if [[ "$home_path" == native ]]; then
  [[ "$resolved" == "$DSKY_HOME" ]] \
    || fail "HOME resolves to ${resolved:-nothing}, expected $DSKY_HOME"
  printf 'HOME resolution after Fire Launcher disable: %s\n' "$resolved"
else
  current_services="$("${ADB[@]}" shell settings get secure enabled_accessibility_services 2>/dev/null | tr -d '\r\n' || true)"
  [[ "$current_services" == null ]] && current_services=""
  case ":$current_services:" in
    *":$FIRE_SERVICE_FULL:"*|*":$FIRE_SERVICE_SHORT:"*) new_services="$current_services" ;;
    "::") new_services="$FIRE_SERVICE_FULL" ;;
    *) new_services="$current_services:$FIRE_SERVICE_FULL" ;;
  esac
  # Replacing an APK can leave the service name persisted while Fire OS has no
  # live binding. Cycle the framework so the restored component is rebound.
  "${ADB[@]}" shell settings put secure accessibility_enabled 0
  "${ADB[@]}" shell settings put secure enabled_accessibility_services "$new_services"
  "${ADB[@]}" shell settings put secure accessibility_enabled 1
  "${ADB[@]}" shell am start -a "$PACKAGE.FIRE_ENABLE" -n "$FIRE_MODE" >/dev/null
  "${ADB[@]}" shell pm enable "$FIRE_RECEIVER" >/dev/null 2>&1 || true
  sleep 5
  retained_services="$("${ADB[@]}" shell settings get secure enabled_accessibility_services | tr -d '\r\n')"
  case ":$retained_services:" in
    *":$FIRE_SERVICE_FULL:"*|*":$FIRE_SERVICE_SHORT:"*) ;;
    *) fail "Fire redirect accessibility service was not retained" ;;
  esac
  printf 'Native HOME resolver remains protected Amazon Home: %s\n' "$resolved"
fi

"${ADB[@]}" shell input keyevent KEYCODE_HOME
foreground=""
home_deadline=$((SECONDS + 12))
while (( SECONDS < home_deadline )); do
  foreground="$("${ADB[@]}" shell dumpsys activity activities | tr -d '\r' \
    | grep -m1 -E 'mResumedActivity|mFocusedActivity' || true)"
  grep -Fq "$PACKAGE" <<<"$foreground" && break
  sleep 1
done
grep -Fq "$PACKAGE" <<<"$foreground" \
  || fail "HOME did not bring DSKY to the foreground: ${foreground:-unknown}"
printf 'HOME key foreground check: PASS\n'

printf 'Rebooting for the real Fire OS boot-path check...\n'
"${ADB[@]}" reboot
"${ADB[@]}" wait-for-device

boot_deadline=$((SECONDS + 180))
while (( SECONDS < boot_deadline )); do
  boot_completed="$("${ADB[@]}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [[ "$boot_completed" == 1 ]] && break
  sleep 2
done
[[ "${boot_completed:-}" == 1 ]] || fail "device did not report boot completion within 180 seconds"
resolved="$(resolve_home)"
if [[ "$home_path" == native ]]; then
  [[ "$resolved" == "$DSKY_HOME" ]] \
    || fail "HOME after reboot resolves to ${resolved:-nothing}, expected $DSKY_HOME"
fi

foreground=""
foreground_deadline=$((SECONDS + 45))
while (( SECONDS < foreground_deadline )); do
  foreground="$("${ADB[@]}" shell dumpsys activity activities 2>/dev/null | tr -d '\r' \
    | grep -m1 -E 'mResumedActivity|mFocusedActivity' || true)"
  grep -Fq "$PACKAGE" <<<"$foreground" && break
  sleep 2
done
grep -Fq "$PACKAGE" <<<"$foreground" \
  || fail "DSKY did not become foreground HOME after reboot: ${foreground:-unknown}"

"${ADB[@]}" shell input keyevent KEYCODE_HOME
foreground=""
home_deadline=$((SECONDS + 12))
while (( SECONDS < home_deadline )); do
  foreground="$("${ADB[@]}" shell dumpsys activity activities | tr -d '\r' \
    | grep -m1 -E 'mResumedActivity|mFocusedActivity' || true)"
  grep -Fq "$PACKAGE" <<<"$foreground" && break
  sleep 1
done
grep -Fq "$PACKAGE" <<<"$foreground" \
  || fail "HOME key after reboot did not return to DSKY: ${foreground:-unknown}"

trap - ERR INT TERM
launcher_safety_required=false
printf 'Fire tablet HOME setup: PASS\n'
printf '  startup path: %s\n' "$home_path"
printf '  native HOME resolver: %s\n' "$resolved"
printf '  reboot foreground: %s\n' "$foreground"
