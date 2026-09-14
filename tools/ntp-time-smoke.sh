#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
command -v javac >/dev/null 2>&1 || { printf 'NTP TIME SMOKE FAIL: javac is required\n' >&2; exit 1; }
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
javac -d "$temp_dir" \
  "$ROOT/app/src/main/java/org/apollo/agcdsky/SntpClient.java" \
  "$ROOT/tools/NtpTimeSmoke.java"
java -cp "$temp_dir" org.apollo.agcdsky.NtpTimeSmoke "$@"
