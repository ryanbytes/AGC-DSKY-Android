# Command Module yaAGC WebAssembly core

`yaAGC.wasm` is built from the official [VirtualAGC](https://github.com/virtualagc/virtualagc) source at commit `ddc65e7bed41f1301921b934fcbaaee93db99dda` (2021-05-21). Patch `patches/001-cm-mode-api.patch` sets yaAGC's `CmOrLm` peripheral flag to Command Module and exports a CM-only configuration/readback API. Configuration is rejected after the first reset or CPU step.

The pinned build is 27,270 bytes, SHA-256 `38107b6002e3c4e9c8dcb9da208c9d11e60d2a36bbc3b308680e087c561b7cec`, Git blob `04a24dd1df4a81738e138b3e9f048d2b10498439`. The build pins the upstream version string `2020-12-24 ddc65e7`. The reproducible local build is `bash tools/build-cm-wasm.sh /path/to/clean/virtualagc-checkout`, with WASI SDK 16.0, Binaryen 133, and WABT 1.0.42 on `PATH`. The WASI SDK 16.0 macOS archive SHA-256 is `500d51597573c49bad53e6bdecba0acf2405a9dd535c155a68e2db92adcb9c51`.

The binary and patch are GPL-2.0-or-later. See the upstream license in `vendor/webAGC/COPYING` and attribution in `THIRD_PARTY.md`.
