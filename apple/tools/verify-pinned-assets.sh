#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WEBAGC="$ROOT/vendor/webAGC"
PINNED_WEBAGC="0575ea7a1231e3948bae7d2c22a6ac146da0c38d"

fail() {
  printf 'APPLE ASSET VERIFY FAIL: %s\n' "$*" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git is required"
[[ -d "$WEBAGC" ]] || fail "vendor/webAGC is missing; run: git submodule update --init --recursive"

head_sha="$(git -C "$WEBAGC" rev-parse HEAD 2>/dev/null || true)"
[[ "$head_sha" == "$PINNED_WEBAGC" ]] || fail "vendor/webAGC is at ${head_sha:-unknown}; expected $PINNED_WEBAGC"

file_size() {
  local path="$1"
  case "$(uname -s)" in
    Darwin) stat -f '%z' "$path" ;;
    *) stat -c '%s' "$path" ;;
  esac
}

verify_blob() {
  local path="$1" expected_size="$2" expected_blob="$3" label="$4"
  [[ -f "$path" ]] || fail "missing $label at $path"

  local size
  size="$(file_size "$path" 2>/dev/null || true)"
  [[ "$size" == "$expected_size" ]] || fail "$label size is ${size:-unknown}; expected $expected_size"

  local blob
  blob="$(git hash-object "$path")"
  [[ "$blob" == "$expected_blob" ]] || fail "$label Git blob SHA-1 is $blob; expected $expected_blob"
}

verify_blob "$WEBAGC/src/yaAGC.wasm" 132617 713685680492098d05437b99c26403f683d56009 "yaAGC.wasm"
verify_blob "$WEBAGC/demo/agc/Comanche055.bin" 73728 9e4ec167dc99ac12b233df07b6b91fef585e5015 "Comanche055.bin"

printf 'Apple pinned AGC assets: PASS\n'
printf 'webAGC: %s\n' "$head_sha"
