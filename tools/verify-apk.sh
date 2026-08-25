#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${1:-$ROOT/app/build/outputs/apk/debug/app-debug.apk}"

fail() {
  printf 'VERIFY FAIL: %s\n' "$*" >&2
  exit 1
}

[[ -f "$APK" ]] || fail "APK not found: $APK"
command -v unzip >/dev/null 2>&1 || fail "unzip is required"
command -v git >/dev/null 2>&1 || fail "git is required for Git-blob verification"

verify_blob() {
  local entry="$1"
  local expected_size="$2"
  local expected_blob="$3"
  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' RETURN

  unzip -p "$APK" "$entry" > "$tmp" || fail "missing APK entry: $entry"

  local actual_size actual_blob
  actual_size="$(wc -c < "$tmp" | tr -d '[:space:]')"
  [[ "$actual_size" == "$expected_size" ]] \
    || fail "$entry is $actual_size bytes; expected $expected_size"

  actual_blob="$(git hash-object "$tmp")"
  [[ "$actual_blob" == "$expected_blob" ]] \
    || fail "$entry Git blob $actual_blob; expected $expected_blob"

  rm -f "$tmp"
  trap - RETURN
}

verify_blob assets/yaAGC.wasm 132617 713685680492098d05437b99c26403f683d56009
verify_blob assets/Luminary099.bin 73728 cd2ec9992d5863e1c7234fa760020f68ef946202
verify_blob assets/Comanche055.bin 73728 9e4ec167dc99ac12b233df07b6b91fef585e5015

# The Android build stages only the three required vendor binaries. Whole
# upstream source/demo trees must never leak into the APK again.
apk_entries="$(unzip -Z1 "$APK")"
for forbidden in \
  assets/Validation.bin \
  assets/webAGC.js \
  assets/lib/wasm_c_utilities/load.js \
  assets/lib/wasm_c_utilities/strings.js; do
  if grep -Fxq "$forbidden" <<<"$apk_entries"; then
    fail "unexpected unused vendor asset packaged: $forbidden"
  fi
done

SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"

find_latest_tool() {
  local name="$1"
  local candidate=""
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  if [[ -n "$SDK" && -d "$SDK/build-tools" ]]; then
    candidate="$(find "$SDK/build-tools" -type f -name "$name" -perm -111 2>/dev/null \
      | sort -V | tail -n 1)"
  fi
  [[ -n "$candidate" ]] || return 1
  printf '%s\n' "$candidate"
}

AAPT2="$(find_latest_tool aapt2 || true)"
[[ -n "$AAPT2" ]] || fail "aapt2 not found; cannot verify merged APK permissions"

permissions="$($AAPT2 dump permissions "$APK")"
if grep -Fq 'android.permission.INTERNET' <<<"$permissions"; then
  fail "merged APK requests android.permission.INTERNET"
fi

APKSIGNER="$(find_latest_tool apksigner || true)"
[[ -n "$APKSIGNER" ]] || fail "apksigner not found; cannot verify APK signature"
"$APKSIGNER" verify --verbose "$APK" >/dev/null \
  || fail "APK signature verification failed"

printf 'APK verification: PASS\n'
printf '  %s\n' "$APK"
printf '  pinned yaAGC/WASM + both ropes match exact Git blobs\n'
printf '  unused upstream vendor assets are absent\n'
printf '  merged manifest has no INTERNET permission\n'
printf '  APK signature verifies\n'
