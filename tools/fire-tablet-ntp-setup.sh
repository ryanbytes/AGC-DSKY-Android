#!/usr/bin/env bash
set -Eeuo pipefail

fail() { printf 'FIRE NTP SETUP FAIL: %s\n' "$*" >&2; exit 1; }
command -v adb >/dev/null 2>&1 || fail 'adb is not installed or not on PATH'
device_count="$(adb devices | awk 'NR > 1 && $2 == "device" { count++ } END { print count + 0 }')"
[[ "$device_count" == 1 ]] || fail "connect exactly one authorized Android device; found $device_count"
serial="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }')"
ADB=(adb -s "$serial")
prop() { "${ADB[@]}" shell getprop "$1" | tr -d '\r'; }
manufacturer="$(prop ro.product.manufacturer)"; model="$(prop ro.product.model)"
android_version="$(prop ro.build.version.release)"; fire_version="$(prop ro.build.version.name)"
printf 'Device serial: %s\nManufacturer/model: %s %s\nAndroid: %s\nFire OS build: %s\n' "$serial" "$manufacturer" "$model" "$android_version" "$fire_version"

# This script deliberately does not inspect, assign, disable, or otherwise touch HOME/launcher settings.
"${ADB[@]}" shell settings put global auto_time 1
"${ADB[@]}" shell settings put global ntp_server time.cloudflare.com
auto_time="$("${ADB[@]}" shell settings get global auto_time | tr -d '\r\n')"
ntp_server="$("${ADB[@]}" shell settings get global ntp_server | tr -d '\r\n')"
printf 'Verified global auto_time: %s\nVerified global ntp_server: %s\n' "$auto_time" "$ntp_server"
[[ "$auto_time" == 1 ]] || fail "global auto_time did not persist as 1 (read back: ${auto_time:-empty})"
[[ "$ntp_server" == time.cloudflare.com ]] || fail "global ntp_server did not persist as time.cloudflare.com (read back: ${ntp_server:-empty})"
printf 'Fire NTP setup: PASS (settings persisted; OS synchronization behavior still requires a real time check)\n'
