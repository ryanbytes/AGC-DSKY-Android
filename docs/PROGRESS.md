# AGC DSKY Android progress

Last updated: 2026-08-22

## Goal

Ship an Android DSKY that keeps the phone clock / DreamService mode but also contains a real Apollo Guidance Computer execution core. In AGC mode, DSKY displays, annunciators, COMP ACTY, and key input must be driven by actual AGC I/O rather than phone/network stand-ins.

## Current state

- Android Activity and DreamService shells exist.
- DSKY face, keys, annunciators, and fixed-coordinate SVG EL display exist.
- Phone clock mode is implemented as V16 N65.
- V35 lamp test is implemented in clock mode.
- Dim mode and DreamService brightness/pixel drift are implemented.
- EL digit segments were redrawn in commit `a70c2437d69729b6217d5cfa1cbbb57e7be04ad6`.
- `AGENTS.md` now contains durable handoff/rules for other coding agents (`747f693`).
- webAGC is pinned as `vendor/webAGC` at upstream commit `0575ea7a1231e3948bae7d2c22a6ac146da0c38d` (`31a9ebd`).
- Gradle v0.7 source sets now package the pinned `yaAGC.wasm` and Apollo 11 rope files when the repository is cloned recursively (`05e6786`).
- The native `TrafficStats` / `agcnet://poll` COMP ACTY surrogate has been removed. `NetClient` now serves packaged assets from a synthetic local HTTPS origin (`61bfd05`).
- MainActivity and DreamService both use the synthetic HTTPS asset origin (`4ddd97f`, `6d9f657`).
- `agc-core.js` implements an offline yaAGC embedding wrapper with a minimal WASI shim, rope loading, CPU stepping, packet I/O, input-channel masks, normal DSKY keys, and PRO (`75cc247`).
- The UI has an onboard AGC/CLOCK mode control (`c1fb49d`).
- `app.js` now decodes authentic AGC DSKY I/O and sends authentic Pinball key codes (`60749ac`).
- Third-party/core provenance is updated (`754c2dc`).
- No GitHub Actions build workflow should be added. Builds are local/manual.

## Confirmed authentic mappings now implemented

### COMP ACTY

- Output channel: `011` octal
- Signal: COMACT / COMP ACTY
- Bit: 2 (Apollo 1-based bit numbering)
- Numeric mask: `0b10` / octal `00002`

The UI now uses this value directly. Phone/network traffic is no longer a source for COMP ACTY.

### DSKY output channel 010

The relay word is decoded as:

- bits 15-12: relay selector
- bit 11: sign/special relay bit
- bits 10-6: left 5-bit relay code
- bits 5-1: right 5-bit relay code

Implemented relay selectors:

- 11: PROG digits
- 10: VERB digits
- 9: NOUN digits
- 8 through 1: R1/R2/R3 digit and sign relays
- 12: VEL, NO ATT, ALT, GIMBAL LOCK, TRACKER, and PROG annunciators

The 5-bit digit relay-code table is taken from Apollo/VirtualAGC DSKY handling, not a decimal assumption.

### Other DSKY lamps

- Channel `011`: COMP ACTY and UPLINK ACTY.
- yaAGC fictitious/modulated channel `0163`: TEMP, KEY REL, VERB/NOUN flashing state, OPR ERR, RESTART, STBY, and EL-off state.

### Keyboard input

Normal DSKY key input uses channel `015` octal with the Apollo Pinball 5-bit codes:

- digits 1-9: `01`-`11` octal
- 0: `20`
- VERB: `21`
- RSET / error reset: `22`
- KEY REL: `31`
- `+`: `32`
- `-`: `33`
- ENTER: `34`
- CLEAR: `36`
- NOUN: `37`

PRO/Proceed is not a normal key code. It is input channel `032` octal, bit 14 (`20000` octal), and is pulsed separately.

The embedded peripheral sets yaAGC U-bit masks so it only owns the DSKY key bits it is supposed to affect:

- channel `015` mask `00037`
- channel `032` mask `20000`

## Core/runtime implementation

The selected core is the VirtualAGC `yaAGC` WebAssembly build used by `michaelfranzl/webAGC`.

Pinned upstream WASM imports were inspected. This build imports only:

- `env.memory`
- `wasi_snapshot_preview1.fd_close`
- `wasi_snapshot_preview1.fd_fdstat_get`
- `wasi_snapshot_preview1.fd_seek`
- `wasi_snapshot_preview1.fd_write`

`agc-core.js` supplies those four WASI calls locally rather than bundling the full `@wasmer/wasi` / `@wasmer/wasmfs` dependency stack.

The wrapper currently uses these yaAGC exports:

- `malloc`
- `free`
- `set_fixed`
- `cpu_reset`
- `cpu_step`
- `packet_write`
- `packet_read`
- optional `version`

Initial/default rope: Apollo 11 LM `Luminary099.bin`.

CPU scheduling follows webAGC's approximate 11.72 microseconds per AGC instruction and drains output packets at roughly 60 Hz.

## Android asset design

The app no longer starts from `file:///android_asset/`. It uses:

`https://appassets.androidplatform.net/assets/`

`NetClient.shouldInterceptRequest()` serves that host directly from the APK's `AssetManager`. This is intended to let `fetch('yaAGC.wasm')` and `fetch('Luminary099.bin')` behave like normal same-origin HTTPS requests while remaining completely offline.

Gradle expects a recursive clone because the actual WASM/rope binaries live in the pinned submodule:

```bash
git clone --recurse-submodules <repo>
```

or, for an existing checkout:

```bash
git submodule update --init --recursive
```

## Verification status

### Implemented but not yet runtime-proven

The source path from Android WebView -> local HTTPS asset interception -> `yaAGC.wasm` -> minimal WASI -> `Luminary099.bin` -> CPU stepping -> packet drain is implemented, but has **not yet been executed on an Android device/emulator in this environment**.

Therefore do **not** yet claim that the onboard AGC is operational.

### Verification gates still required

- [ ] Clean recursive clone contains `vendor/webAGC/src/yaAGC.wasm` and `vendor/webAGC/demo/agc/Luminary099.bin`.
- [ ] Local Gradle build succeeds with the v0.7 asset source sets.
- [ ] Main page loads from the synthetic HTTPS asset origin.
- [ ] `fetch('yaAGC.wasm')` returns the packaged WASM offline.
- [ ] Minimal WASI shim satisfies the pinned yaAGC binary at instantiation/runtime.
- [ ] `Luminary099.bin` loads through `set_fixed()`.
- [ ] CPU stepping produces real output packets.
- [ ] Channel `010` output visibly populates PROG/VERB/NOUN/R1/R2/R3 correctly.
- [ ] COMP ACTY visibly follows channel `011`, bit 2.
- [ ] At least one real DSKY keypress through channel `015` produces the expected Pinball response.
- [ ] PRO through channel `032`, bit 14 is accepted.
- [ ] APK installs and runs on an Android device/emulator.

## Known risks / likely first debugging points

1. **Minimal WASI semantics.** The import list is known, but libc may expect more detailed `fd_fdstat_get` behavior than the current shim provides. If instantiation succeeds but an exported call traps, inspect the trap before adding a large WASI dependency.
2. **WebView asset interception.** Confirm main-frame and subresource requests are intercepted by `NetClient` under the synthetic HTTPS host.
3. **Submodule checkout.** A non-recursive clone will not contain the WASM/rope binaries and the Android build/runtime assets will be incomplete.
4. **Display relay edge cases.** Verify sign clearing, blank relay codes, VN flashing polarity, and EL-off behavior against real yaAGC output.
5. **CPU timing.** The 60 Hz scheduling approach mirrors webAGC but Android WebView throttling/background behavior may require compensation.

## Build/signing note

The original private v5/v6 signing key is not committed. A locally generated replacement key cannot update an APK signed by that original key; Android requires matching signatures for in-place updates. Never commit private signing material.

## Next concrete checkpoint

Perform a real local v0.7 build from a recursive checkout, run it on Android, capture the first yaAGC initialization/output behavior, and fix only the concrete runtime failures observed. The first success criterion is not a polished UI: it is `Luminary099` executing and producing authentic channel packets inside the APK.
