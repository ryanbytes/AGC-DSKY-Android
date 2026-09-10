#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SOURCE_ASSETS="$ROOT/app/src/main/assets"
WEBAGC="$ROOT/vendor/webAGC"
DEST="${TARGET_BUILD_DIR:?}/${UNLOCALIZED_RESOURCES_FOLDER_PATH:?}/WebAssets"

"$ROOT/apple/tools/verify-pinned-assets.sh"
[[ -d "$SOURCE_ASSETS" ]] || { printf 'Missing Android/shared web assets: %s\n' "$SOURCE_ASSETS" >&2; exit 1; }

rm -rf "$DEST"
mkdir -p "$DEST"
/usr/bin/rsync -a --delete --exclude '.DS_Store' "$SOURCE_ASSETS/" "$DEST/"
/bin/cp "$WEBAGC/src/yaAGC.wasm" "$DEST/yaAGC.wasm"
/bin/cp "$WEBAGC/demo/agc/Comanche055.bin" "$DEST/Comanche055.bin"

[[ -f "$DEST/index.html" ]] || { echo 'Staged bundle is missing index.html' >&2; exit 1; }
[[ -f "$DEST/yaAGC.wasm" ]] || { echo 'Staged bundle is missing yaAGC.wasm' >&2; exit 1; }
[[ -f "$DEST/Comanche055.bin" ]] || { echo 'Staged bundle is missing Comanche055.bin' >&2; exit 1; }

printf 'Staged AGC DSKY web assets to %s\n' "$DEST"
