# AGC DSKY Android progress

Last updated: 2026-08-22

## Goal

Ship an Android DSKY that keeps the phone clock / DreamService mode but also contains a real Apollo Guidance Computer execution core. In AGC mode, DSKY displays, annunciators, COMP ACTY, and key input must be driven by actual AGC I/O rather than phone/network stand-ins.

## Current state

- Android Activity and DreamService shells exist.
- DSKY face, keys, annunciators, and fixed-coordinate SVG EL display exist.
- Phone clock mode is implemented as V16 N65.
- V35 lamp test is implemented in clock mode.
- Normal-app DIM is independent from Dream/screensaver brightness.
- DreamService is display-only and retains pixel drift for burn-in mitigation.
- Dream brightness now has three persistent modes: `DIM`, `BRIGHT`, and `SOLAR`.
- `SOLAR` requests coarse/fine device location only when first selected, stores latitude/longitude locally, then computes sunrise/sunset offline.
- Solar mode uses a smooth one-hour transition centered on local sunrise and sunset. EL brightness, Android Dream window brightness, and tick volume all follow the same transition factor.
- Night solar tick volume bottoms at roughly 8% rather than abruptly muting; the master TICK option remains independent.
- Display-only mode hides the keypad, app controls, hint, and lower fasteners. A hidden long hold exits display-only in the normal app; DreamService remains non-interactive.
- EL rendering now uses a brighter mint-green phosphor core with restrained glass bloom rather than an LED-like halo.
- Clock-mode relay sound now follows Block II latching-relay state changes: five relay bits per character plus the row discrete/sign bit, not one invented relay per seven-segment stroke.
- EL digit segments were redrawn in commit `a70c2437d69729b6217d5cfa1cbbb57e7be04ad6`.
- `AGENTS.md` contains durable handoff/rules for other coding agents (`747f693`).
- webAGC is pinned as `vendor/webAGC` at upstream commit `0575ea7a1231e3948bae7d2c22a6ac146da0c38d` (`31a9ebd`).
- Gradle v0.7 source sets package the pinned `yaAGC.wasm` and Apollo 11 rope files when the repository is cloned recursively (`05e6786`).
- The native `TrafficStats` / `agcnet://poll` COMP ACTY surrogate has been removed. `NetClient` serves packaged assets from a synthetic local HTTPS origin (`61bfd05`) and its error responses were hardened in `4609c89`.
- MainActivity and DreamService both use the synthetic HTTPS asset origin (`4ddd97f`, `6d9f657`).
- `agc-core.js` implements an offline yaAGC embedding wrapper with a minimal WASI shim, rope loading, CPU stepping, packet I/O, input-channel masks, normal DSKY keys, and PRO (`75cc247`).
- The UI has an onboard AGC/CLOCK mode control (`c1fb49d`).
- `app.js` decodes authentic AGC DSKY I/O and sends authentic Pinball key codes (`60749ac`).
- yaAGC VERB/NOUN flashing and EL-off states now have visible CSS behavior (`408aaaf`, `d4e72f8`).
- Third-party/core provenance and protocol references are current (`754c2dc`, `fda2fd1`).
- README and implementation notes describe v0.7 rather than the obsolete network-light architecture (`ba88a43`, `9273d7b`).
- No GitHub Actions build workflow should be added. Builds are local/manual.

## Local build recovery checkpoint — 2026-08-22

The current objective is a **clean, self-contained native APK built from source**, not another repacked diagnostic shell.

Hard requirements for the test/final APK:

- Runtime must be self-contained. No Internet/network dependency is permitted.
- Device location is the only external runtime input and is used only for `DREAM SOLAR` sunrise/sunset behavior.
- The final manifest should not request `android.permission.INTERNET`; the committed manifest must be checked/updated before the clean build if that permission is still present.
- All HTML, CSS, JavaScript, sounds, `yaAGC.wasm`, and Apollo rope data must be packaged in the APK.
- Build, packaging, signing, and verification are local/manual. **Do not build with GitHub Actions, Codespaces, or other GitHub-hosted build infrastructure.** GitHub may be used only as a source/code repository.
- The deliverable must be compiled from the normal Java/Gradle source tree. Do not use hand-edited Dalvik/DEX bytecode, repacked diagnostic APKs, or other emergency binary surgery as the final implementation.
- Keep the native shell small and conventional: `MainActivity`, `AgcDreamService`, `NetClient`, and `DebugReporter` plus the local web/AGC assets. Avoid duplicate loading paths and fallback network code.

Recent diagnostic history, retained only so the same failures are not rediscovered:

1. An emergency hand-built diagnostic APK reported `targetSdk 29` / version `0` and was not the real v0.7 Gradle build.
2. GrapheneOS/ART first rejected that diagnostic DEX because `MainActivity.onCreate()` used `invoke-virtual` for private `startDsky()`. Current Java source fixes this structurally by keeping `startDsky()` non-private (`e6405f7a4aaf93537917dc8e99f74a8ba4a0c4ea`).
3. After that verifier issue was bypassed in the diagnostic APK, the next crash was `StringIndexOutOfBoundsException` in `NetClient.shouldInterceptRequest()` caused by unsafe substring/prefix arithmetic. The clean source build must use bounds-safe URI/path handling rather than reproducing the diagnostic implementation.
4. Those diagnostic APKs are not candidates for release and must not be used as the base of the final build.

Binary-integrity status during local recovery:

- Pinned `yaAGC.wasm`: **132,617 bytes**, independently reconstructed and verified against Git blob SHA `713685680492098d05437b99c26403f683d56009`. Treat this byte sequence as verified.
- Apollo 11 `Luminary099.bin`: expected **73,728 bytes**, pinned Git blob SHA `cd2ec9992d5863e1c7234fa760020f68ef946202`.
- A manually relayed/reconstructed rope copy reached the expected length but failed the pinned blob hash. It is rejected and must not be packaged.
- Work is continuing to obtain/reconstruct `Luminary099.bin` through a clean path and the entire file must match the pinned blob SHA before it is accepted.
- Do not claim a self-contained APK is complete until both binaries are hash-verified and present inside the built APK.

Build-environment status:

- The current sandbox has Java available but did not initially contain Gradle or an Android SDK/build-tools installation.
- A proper Android build toolchain is required for the final APK. Do not substitute another hand-written/repacked DEX path merely to produce an installable file.
- A successful build is not sufficient by itself: inspect the resulting APK manifest and packaged assets, verify signatures/integrity, then test it on Android/GrapheneOS.

## Prototype-fidelity pass

### Clock display servicing

Clock mode is synthetic, but it now imitates the real Block II DSKY electrical organization instead of acting like an LCD clock.

- No hundredths animation.
- The face is not repainted continuously.
- Dirty DSKY relay rows are serviced individually at about 120 ms spacing.
- The visible EL update follows the relay operation after a short settle interval.
- Each decimal character is represented by the actual five-bit DSKY relay code used by channel `010`.
- Audible clicks are based on the Hamming delta of those relay states, so a digit transition can produce several tightly grouped mechanical clicks.
- The seven visible EL strokes are the contact-matrix result of the five relay bits; they are not treated as seven independent relays.

AGC mode does not use the synthetic clock scheduler. It continues to follow actual yaAGC channel `010` words.

### Dream brightness modes

The hidden control cycles:

1. `DREAM DIM` — fixed low EL level and low Android window brightness.
2. `DREAM BRIGHT` — full EL level and high window brightness for daytime charging.
3. `DREAM SOLAR` — local astronomical sunrise/sunset control.

Solar setup/behavior:

- MainActivity enables WebView geolocation and requests Android location permission only when `navigator.geolocation` is actually invoked by selecting SOLAR.
- Coordinates are retained only in local DOM storage by the frontend.
- After location is saved, sunrise/sunset computation is offline.
- Solar event calculation uses the standard apparent sunrise/sunset altitude of `-0.833°`.
- A smooth transition runs from 30 minutes before through 30 minutes after each sunrise/sunset.
- Dream window brightness tracks approximately `0.05 .. 0.85` across that factor.
- EL face brightness tracks approximately `0.20 .. 1.00` with saturation also restored toward daytime values.
- Tick amplitude tracks approximately `0.08 .. 1.00` on the same curve.
- Solar state is recomputed once per minute while DreamService is active.

The Wabash-area sanity check for 2026-08-22 produced approximately 07:01 sunrise and 20:33 sunset, within a few minutes of published local values. This is a calculation check only, not Android runtime verification.

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

A source consistency pass rechecked the register mapping against VirtualAGC `convertNasspLog.py`; notably relay 8 correctly takes R1 digit 1 from the right-hand (`D`) 5-bit field.

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

The U-bit behavior was cross-checked against the VirtualAGC developer protocol. webAGC's frontend behavior was also checked: normal key events are passed to `keyPress`, while PRO is delivered as a separate pressed/released state.

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

## Static consistency checks completed

- Repository search finds no remaining `TrafficStats`, `agcnet`, `phoneTraffic`, or old `realagc` references.
- Channel `010` register-relay placement was rechecked against VirtualAGC's own playback generator.
- Channel `011` COMP ACTY/UPLINK bit masks were rechecked against VirtualAGC/webAGC.
- Normal key versus PRO handling was rechecked against webAGC's DSKY event path and the VirtualAGC protocol documentation.
- Channel `0163` VN-flash and EL-off state now has corresponding CSS instead of being a no-op UI class.
- Solar sunrise/sunset math was sanity-checked against published local times for 2026-08-22.
- Current committed JavaScript was manually/static reviewed after the solar-mode update; this does not replace execution in Android WebView.

These checks do not substitute for running the WASM and Dream/permission paths in Android.

## Verification status

### Implemented but not yet runtime-proven

The source path from Android WebView -> local HTTPS asset interception -> `yaAGC.wasm` -> minimal WASI -> `Luminary099.bin` -> CPU stepping -> packet drain is implemented, but has **not yet been executed on an Android device/emulator in this environment**.

The latest native source also adds runtime location permission and a JavaScript Dream brightness bridge. Those changes require a real native rebuild; do not represent them as verified merely because older repacked APK shells install.

Therefore do **not** yet claim that the onboard AGC, SOLAR Dream mode, or native brightness bridge is operational until a current native APK is built and run.

### Verification gates still required

- [ ] Clean recursive clone contains `vendor/webAGC/src/yaAGC.wasm` and `vendor/webAGC/demo/agc/Luminary099.bin`.
- [ ] Local Gradle build succeeds with the current native source and v0.7 asset source sets.
- [ ] Main page loads from the synthetic HTTPS asset origin.
- [ ] `fetch('yaAGC.wasm')` returns the packaged WASM offline.
- [ ] Minimal WASI shim satisfies the pinned yaAGC binary at instantiation/runtime.
- [ ] `Luminary099.bin` loads through `set_fixed()`.
- [ ] CPU stepping produces real output packets.
- [ ] Channel `010` output visibly populates PROG/VERB/NOUN/R1/R2/R3 correctly.
- [ ] COMP ACTY visibly follows channel `011`, bit 2.
- [ ] At least one real DSKY keypress through channel `015` produces the expected Pinball response.
- [ ] PRO through channel `032`, bit 14 is accepted.
- [ ] DISPLAY mode crops/scales the upper DSKY correctly on portrait and landscape phones.
- [ ] DreamService is always display-only and remains non-interactive.
- [ ] `DREAM DIM` sets the expected low EL and Android-window brightness.
- [ ] `DREAM BRIGHT` visibly reaches daytime charging brightness.
- [ ] First selection of `DREAM SOLAR` requests location permission and persists coordinates locally.
- [ ] `DREAM SOLAR` changes brightness/tick amplitude around computed sunrise/sunset as designed.
- [ ] TICK remains independently switchable in all Dream brightness modes.
- [ ] APK installs and runs on an Android device/emulator.

## Known risks / likely first debugging points

1. **Minimal WASI semantics.** The import list is known, but libc may expect more detailed `fd_fdstat_get` behavior than the current shim provides. If instantiation succeeds but an exported call traps, inspect the trap before adding a large WASI dependency.
2. **WebView asset interception.** Confirm main-frame and subresource requests are intercepted by `NetClient` under the synthetic HTTPS host.
3. **Submodule checkout.** A non-recursive clone will not contain the WASM/rope binaries and the Android build/runtime assets will be incomplete.
4. **Display relay edge cases.** Verify sign clearing, blank relay codes, VN flashing polarity, EL-off behavior, and click counting against real yaAGC output/hardware references.
5. **CPU timing.** The 60 Hz scheduling approach mirrors webAGC but Android WebView throttling/background behavior may require compensation.
6. **Geolocation permission.** GrapheneOS/Android can deny or grant approximate location; SOLAR must degrade to DIM cleanly when location is unavailable.
7. **Dream brightness bridge.** Verify WebView JavaScript interface calls continue while DreamService is active and that the system does not override `screenBrightness`.
8. **Polar locations.** If the standard sunrise/sunset event does not occur on a date, the current SOLAR fallback is night/dim. A future refinement may choose a solar-elevation model for polar day/night behavior.

## Build/signing note

The original private v5/v6 signing key is not committed. A locally generated replacement key cannot update an APK signed by that original key; Android requires matching signatures for in-place updates. Never commit private signing material.

Older hand-repacked APKs do not include the latest native location-permission and DreamBridge code. Do not label one of those as the current SOLAR build.

## Next concrete checkpoint

Perform a real local native build from a recursive checkout, run it on Android, and verify both paths:

1. `Luminary099` executes and produces authentic channel packets inside the APK.
2. DreamService DIM/BRIGHT/SOLAR, display-only crop, location permission, solar brightness curve, and tick-volume taper work on an actual phone.
