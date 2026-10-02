#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${1:-${VIRTUALAGC_SOURCE:-}}"
SDK="${WASI_SDK_PATH:-}"
SOURCE_COMMIT=ddc65e7bed41f1301921b934fcbaaee93db99dda
WASM_SHA256=38107b6002e3c4e9c8dcb9da208c9d11e60d2a36bbc3b308680e087c561b7cec
WASM_SIZE=27270
PATCH_FILE="$ROOT/vendor/yaAGC-cm/patches/001-cm-mode-api.patch"
OUTPUT="$ROOT/vendor/yaAGC-cm/yaAGC.wasm"
fail(){ printf 'CM WASM BUILD FAIL: %s\n' "$*" >&2; exit 1; }

[[ -n "$SOURCE" && -d "$SOURCE/.git" ]] || fail "pass a clean VirtualAGC Git checkout at $SOURCE_COMMIT"
[[ -n "$SDK" && -x "$SDK/bin/clang" && -x "$SDK/bin/wasm-ld" && -d "$SDK/share/wasi-sysroot" ]] || fail "set WASI_SDK_PATH to WASI SDK 16.0"
command -v git >/dev/null && command -v tar >/dev/null && command -v patch >/dev/null || fail "git, tar, and patch are required"
command -v make >/dev/null || fail "make is required"
command -v wasm-opt >/dev/null && command -v wasm-strip >/dev/null || fail "Binaryen wasm-opt and WABT wasm-strip are required"

ACTUAL_COMMIT="$(git -C "$SOURCE" rev-parse HEAD)"
[[ "$ACTUAL_COMMIT" == "$SOURCE_COMMIT" ]] || fail "source commit is $ACTUAL_COMMIT; expected $SOURCE_COMMIT"
[[ -z "$(git -C "$SOURCE" status --porcelain --untracked-files=all)" ]] || fail "source checkout must be clean"
[[ "$("$SDK/bin/clang" --version | sed -n '1s/.*version \([^ ]*\).*/\1/p')" == 14.0.4 ]] || fail "WASI SDK clang must be 14.0.4"
[[ "$("$SDK/bin/wasm-ld" --version | sed -n '1s/.* \([^ ]*\)$/\1/p')" == 14.0.4 ]] || fail "WASI SDK LLD must be 14.0.4"
[[ "$(wasm-opt --version | sed -n '1s/.*version \([^ ]*\).*/\1/p')" == 133 ]] || fail "Binaryen wasm-opt must be version 133"
[[ "$(wasm-strip --version | sed -n '1s/^\([0-9.]*\).*/\1/p')" == 1.0.42 ]] || fail "WABT wasm-strip must be version 1.0.42"

TEMP="$(mktemp -d "${TMPDIR:-/tmp}/agc-dsky-cm-wasm.XXXXXX")"
cleanup(){ python3 -c 'import shutil,sys; shutil.rmtree(sys.argv[1],ignore_errors=True)' "$TEMP"; }
trap cleanup EXIT
git -C "$SOURCE" archive "$SOURCE_COMMIT" | tar -x -C "$TEMP"
git -C "$TEMP" apply --check "$PATCH_FILE"
git -C "$TEMP" apply "$PATCH_FILE"

WASI_LIB="$SDK/share/wasi-sysroot/lib/wasm32-wasi"
LDFLAGS2="--no-entry --export-dynamic --allow-undefined -L $WASI_LIB -lc --export=malloc --export=free --import-memory --lto-O3"
PATH="$(dirname "$(command -v wasm-opt)"):$(dirname "$(command -v wasm-strip)"):$PATH" \
  make -B -C "$TEMP/yaAGC" WASI=yes WASI_SDK_PATH="$SDK" NVER='2020-12-24 ddc65e7' LDFLAGS2="$LDFLAGS2" yaAGC.wasm

BUILT="$TEMP/yaAGC/yaAGC.wasm"
[[ "$(wc -c < "$BUILT" | tr -d '[:space:]')" == "$WASM_SIZE" ]] || fail "rebuilt WASM size differs from pinned $WASM_SIZE-byte output"
[[ "$(shasum -a 256 "$BUILT" | awk '{print $1}')" == "$WASM_SHA256" ]] || fail "rebuilt WASM SHA-256 differs from pinned output"
cp "$BUILT" "$OUTPUT"
printf 'CM WASM rebuild: PASS\nSource commit: %s\nWASM: %s\n' "$SOURCE_COMMIT" "$OUTPUT"
