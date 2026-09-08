# AGC DSKY Android

Android Apollo Block II DSKY clock/screensaver and Apollo Guidance Computer emulator.

## Current source state

`main` is currently aligned with the verified **v0.38.3-diagnostics-state-fix** source recovery.

The interactive app is now **Command Module only** and uses the Apollo 11 **Comanche 055** rope with the pinned `yaAGC.wasm` runtime. The normal app is DSKY-focused; the old rendered spacecraft-panel scene is not loaded and no raster panel JPG assets are packaged.

Current features include:

- Apollo Block II-style 19-key DSKY with fixed-coordinate SVG electroluminescent display geometry.
- Real `yaAGC` WebAssembly execution using the pinned Comanche 055 rope.
- Native Android sensor bridge through `SensorMainActivity`.
- Phone attitude injection through the ICDU path.
- Linear-acceleration/PIPA input support, including calibration and health reporting.
- Magnetic-reference correction and true-sky camera pointing support.
- Sextant/camera optics interface and Apollo navigation-star helper.
- AGC state snapshot save/restore, autosave, fingerprinting, and round-trip verification.
- Runtime diagnostics for AGC state, DSKY channels, ICDU, PIPA, optics, sensor health, and saved state.
- Synthetic DSKY relay-click audio with background/visibility guarding.
- `V16 N65` phone-clock mode and source-backed `V35E` display/light-test behavior.
- Android DreamService clock/screensaver mode.
- Resizable home-screen widget that renders only the EL display section.
- Full-screen / EL-focused display controls.
- Offline runtime: the packaged app does not request Android INTERNET permission.

## AGC runtime

The emulator path is:

1. Android loads the packaged DSKY page from the app's synthetic local HTTPS asset origin.
2. `agc-core.js` loads packaged `yaAGC.wasm` and `Comanche055.bin`.
3. The rope is copied into yaAGC fixed memory.
4. The core initializes the simulated peripheral input masks and the CM ISS-operate discrete.
5. The AGC runs at approximately real machine-cycle timing while the app is active.
6. `packet_read()` output drives DSKY display relays and annunciators.
7. DSKY and navigation/optics inputs are returned through the simulated AGC I/O paths.

Important implemented channels include:

- `010` octal — display relay words and condition annunciators.
- `011` octal — COMP ACTY and UPLINK ACTY.
- `013` octal — DSKY hardware/test-related output state.
- `0163` octal — modulated DSKY caution/blink/excitation state.
- `015` octal — normal DSKY keyboard input.
- `016` octal — navigation keyboard / MARK path.
- `030` octal — ISS operate discrete ownership used by the phone-backed IMU model.
- `032` octal — PRO/Proceed discrete input.

## Phone IMU, PIPA, and sky pointing

`SensorMainActivity` is the launcher for the interactive app. It bridges Android sensors into the local WebView without enabling network access.

The native bridge provides:

- `GAME_ROTATION_VECTOR` attitude when available, with `ROTATION_VECTOR` fallback/reference.
- Magnetic attitude and sensor-accuracy reporting.
- `LINEAR_ACCELERATION`, with accelerometer/gravity fallback where necessary.
- Display-rotation-aware quaternions.
- Geomagnetic declination calculated from the current location.
- True azimuth/altitude camera pointing.

The JavaScript side consumes those feeds through `phone-icdu.js` and the optics modules, tracks update health, and routes accepted values through the simulated AGC peripheral paths rather than directly painting flight-computer state.

## Optics and diagnostics

The v0.38.3 frontend includes:

- `apollo-stars.js` — Apollo navigation-star catalog and sky-position helpers.
- `optics.js` / `optics.css` — sextant/camera optics interface.
- `phone-icdu.js` — phone attitude, magnetic-reference, sky-pointing, and PIPA bridge.
- `hardware-fidelity.js` — DSKY hardware behavior/fidelity layer.
- `diagnostics.js` / `diagnostics.css` — live AGC/sensor/optics/state diagnostics.
- `cheatsheet.js` / `cheatsheet.css` — in-app command/reference aid.

## State persistence

The app can save and restore the WebAssembly AGC memory image together with the phone-side DSKY presentation state. Snapshots include a fingerprint and can be verified by an export/import round trip. Backgrounding and normal use can trigger autosaves so a running Comanche session can resume instead of restarting from the rope reset state.

## Home-screen EL widget

The Android widget intentionally renders only the DSKY EL section: `COMP ACTY`, `PROG`, `VERB`, `NOUN`, separators, and the three signed registers. It does not include the faceplate, keyboard, annunciator bank, app controls, or spacecraft-panel artwork.

## Source layout

- `app/src/main/assets/index.html` — current DSKY page and runtime module ordering.
- `app/src/main/assets/style.css` — DSKY faceplate, annunciators, keys, and display treatment.
- `app/src/main/assets/app.js` — clock/AGC mode, state persistence, DSKY relay decoding, and key routing.
- `app/src/main/assets/agc-core.js` — offline yaAGC loader, WASI shim, CPU stepping, snapshots, and packet I/O.
- `app/src/main/assets/phone-icdu.js` — phone sensor to ICDU/PIPA/sky bridge.
- `app/src/main/assets/optics.js` — optics/camera/sextant behavior.
- `app/src/main/assets/hardware-fidelity.js` — DSKY hardware behavior refinements.
- `app/src/main/assets/diagnostics.js` — runtime diagnostics UI and tests.
- `app/src/main/java/org/apollo/agcdsky/SensorMainActivity.java` — interactive WebView shell and native sensor bridge.
- `app/src/main/java/org/apollo/agcdsky/AgcDreamService.java` — Android screen saver shell.
- `app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java` — native EL-only home-screen widget.
- `vendor/webAGC` — pinned upstream `yaAGC`/rope submodule.
- `tools/build-local.sh` — deterministic local build entrypoint.
- `tools/gradle-bootstrap.sh` — pinned Gradle bootstrap used when a compatible Gradle is not already installed.

Some older spacecraft-panel support modules remain in source for possible future work, but the current `index.html` does not load the old procedural spacecraft-panel renderer and the build contains no panel JPG assets.

## Build

Requirements:

- JDK 17
- Node.js 18 or newer
- Android compile/target SDK 37
- Android SDK Build Tools 36.0.0
- initialized `vendor/webAGC` submodule at the pinned revision

The current Android Gradle Plugin requires Gradle 9.5 or newer. The repository bootstrap currently pins Gradle **9.5.1**.

Clone with submodules or initialize them before building:

```bash
git clone --recurse-submodules <repository-url>
# or, in an existing clone:
git submodule update --init --recursive
```

Then build with:

```bash
bash tools/build-local.sh
```

The build verifies the pinned `webAGC` revision and exact Git-blob identities of `yaAGC.wasm` and `Comanche055.bin` before packaging.

## Verification status

The recovered v0.38.3 source has been validated by a clean Android `assembleDebug` build using Gradle 9.5.1. The validation also checked that:

- the critical recovered frontend files match the preserved v0.38.3 APK source blobs;
- all current `index.html` local dependencies exist;
- the generated APK contains `yaAGC.wasm` and `Comanche055.bin`;
- the generated APK contains the phone-ICDU, hardware-fidelity, optics, and diagnostics runtime;
- removed spacecraft-panel JPG assets are absent; and
- the manifest does not request Android INTERNET permission.

A successful build does not replace target-device testing for sensor orientation, camera/optics behavior, AGC runtime behavior, audio, widget rendering, or display geometry.

## Signing

The private historical signing key is intentionally not committed. A build signed with a different key cannot update an installation signed by that old key.

## GitHub Actions

No build workflow is enabled on `main`. Repository builds remain local/manual unless that policy is changed explicitly.

## License

Android/frontend code in this repository is GPL-2.0. See `THIRD_PARTY.md` for upstream/core and DSKY geometry attribution and licensing notes.
