# AGC DSKY Android

Android Apollo Block II DSKY clock/screensaver plus onboard AGC emulator project. Source development is currently at **v0.17**.

## Current source state

The v0.17 source integrates a pinned real VirtualAGC `yaAGC` WebAssembly core and Apollo 11 flight-software rope images. The complete Android runtime path has been implemented but has **not yet been device/emulator verified from the current source revision**, so see `docs/PROGRESS.md` before treating AGC mode or the home-screen widget as proven working on a target device.

Current source features:

- Apollo Block II-inspired 19-key DSKY layout.
- Apollo 11-era LM 2×7 annunciator layout, including the two blank positions.
- Fixed-coordinate SVG electroluminescent display so digit fields cannot be independently stretched by CSS.
- Custom narrow EL segment vectors rather than a generic seven-segment font.
- Resizable Android home-screen widget that renders **only the 106×190 EL display section**: no faceplate/bezel, screws, keyboard, annunciator bank, app controls, or Dreaming-mode chrome.
- The native widget reuses the same crew-facing Ben Krasnow DSKY EL segment geometry as the WebView display and remains offline.
- `V16 N65` phone clock mode.
- Source-backed `V35E` clock-mode light test using the channel-010 relay model rather than direct all-8 DOM painting.
- Dim mode.
- Android `DreamService` screen saver intended for charging/idle use.
- Small periodic position drift in dream mode to reduce completely static OLED content.
- Pinned `webAGC` submodule containing `yaAGC.wasm`, `Luminary099.bin`, and `Comanche055.bin`.
- Offline yaAGC WebAssembly wrapper with a minimal four-function WASI shim.
- AGC/CLOCK mode control.
- Persistent mission selector: Apollo 11 LM **Luminary 099** or CM **Comanche 055**.
- AGC execution pauses while the normal app is hidden and resumes in place when the same WebView returns.
- Requested AGC/CLOCK mode and selected mission persist across Activity/page recreation; recreated AGC mode starts from a fresh core reset rather than pretending CPU/erasable-memory state was serialized.
- Authentic Block II DSKY output-channel decoding for numeric registers, signs, and annunciators.
- Authentic DSKY key codes back into yaAGC, including separate press-and-hold PRO/Proceed handling.
- `COMP ACTY` in AGC mode is tied directly to **output channel 011 octal, bit 2**. The old phone-network activity surrogate has been removed.
- One shared channel-010 selector/sign topology is used by the authentic AGC decoder and the synthetic clock relay encoder; invalid five-relay character patterns are rejected rather than silently turned into blanks.
- The V35 model preserves Luminary's physical `FULLDSP`/`FULLDSP1` relay states, including the otherwise-unconnected C five-relay bank on selector 8.
- Local asset interception uses URI path segments rather than substring offsets, avoiding the old diagnostic APK's request-path index crash.
- yaAGC input writes are checked for queue-full/invalid-packet failures rather than silently dropping DSKY input.
- Local builds verify the exact pinned webAGC gitlink and exact Git-blob identities of `yaAGC.wasm`, `Luminary099.bin`, and `Comanche055.bin` before packaging.
- APK verification byte-compares every required current frontend layer, including `app-refine.js`, so the relay/V35 refinements cannot be omitted from a supposedly current package.
- The verified build path instantiates the **real pinned yaAGC WASM under Node** before Gradle runs, validates its complete import/export contract, loads both real ropes, executes CPU cycles and DSKY inputs, and includes a semantic `V37E00E` → `V35E` relay check.
- Debug APK device smoke requires a native `FRONTEND READY app` marker after the WebView frontend completes initialization; a surviving Android process with a blank/partially initialized page does not count as a pass.
- The live V35 device gate is relay-aware: it checks exact Luminary relay latches, rendered `88` / `+88888`, V35 annunciators, and an actual yaAGC-modulated V/N + KEY REL/OPR ERR off phase against raw channel state.

## AGC mode

The default AGC mission uses the Apollo 11 Lunar Module rope **Luminary 099**. The hidden controls can switch to the Apollo 11 Command Module rope **Comanche 055**; the selection is stored locally.

The emulator path is:

1. Android loads the DSKY page from a synthetic local HTTPS asset origin.
2. `agc-core.js` loads packaged `yaAGC.wasm` and supplies its four WASI imports locally.
3. The selected packaged rope (`Luminary099.bin` or `Comanche055.bin`) is copied into yaAGC fixed memory with `set_fixed()`.
4. yaAGC's lazily initialized I/O ring buffers are primed, the CPU is reset back to the true mission reset state, and DSKY input masks are then queued.
5. The CPU is stepped at approximately real AGC timing while the normal app is visible.
6. `packet_read()` output drives the DSKY relay/lamp state.
7. DSKY key presses are sent back through checked `packet_write()` calls.

Implemented DSKY channels include:

- `010` octal — display relay words and six Apollo-11-era LM condition annunciators.
- `011` octal — COMP ACTY and UPLINK ACTY.
- `0163` octal — yaAGC's modulated DSKY caution/blink states.
- `015` octal — normal DSKY keyboard input.
- `032` octal — PRO/Proceed discrete input, held for the actual pointer-down duration and released on pointer-up/cancel/lifecycle exit.

### CM-mode fidelity note

The pinned upstream WASM engine defaults its internal `CmOrLm` global to LM and does not expose a WASM setter. `Comanche055.bin` is still the exact pinned CM rope and is exercised by the real-WASM preflight, but **full CM peripheral-mode fidelity is not currently claimed**. In the ring-buffer path used by webAGC, the known mode-dependent branch is LM rotational-hand-controller bookkeeping on channel `013`; this app does not provide RHC inputs. See `docs/LOCAL_BUILD.md` for the exact limitation and the safe path if an explicit CM mode API is later required.

See `docs/PROGRESS.md` and `docs/DSKY_RELAY_TIMING.md` for the exact relay model and verification status.

## Clock / screen saver

Android uses a `DreamService` for system screen savers. After installing a verified APK:

1. Open Android **Screen saver** settings.
2. Select **AGC DSKY Clock** / AGC DSKY as the screen saver.
3. Set the system start condition to **While charging**.

Dream mode remains a separate display-only phone clock rather than running the AGC core continuously. It uses independent DIM/BRIGHT/SOLAR dream brightness behavior and periodic pixel drift. Returning to the normal app does not intentionally switch the normal app into Dream/clock presentation.

## Home-screen EL widget

The home-screen widget is intentionally narrower than either the normal app or DreamService: it is the EL section itself. Its only layout child is an `ImageView` containing the native EL bitmap. The bitmap preserves the WebView display's 106×190 coordinate system and contains only `COMP ACTY`, `PROG`, `VERB`, `NOUN`, the three register separators, and the three signed register fields.

The widget is resizable in both axes. Resizing re-renders the bitmap while preserving the EL aspect ratio; tapping it opens the app. It asks Android for minute-level updates using an inexact non-wakeup alarm and also redraws after system time/time-zone changes. Android can batch inexact alarms, so this is not a guaranteed second-accurate clock.

## Repository checkout

The emulator core and rope binaries are supplied by a pinned Git submodule, so clone recursively:

```bash
git clone --recurse-submodules <repository-url>
```

For an existing clone:

```bash
git submodule update --init --recursive
```

A checkout without the submodule does not contain the AGC binary assets required by the current source.

## Source layout

- `app/src/main/assets/index.html` — DSKY structure and fixed EL SVG coordinate system.
- `app/src/main/assets/style.css` — physical faceplate, annunciators, keys, display treatment.
- `app/src/main/assets/controls-layout.css` — wrapping behavior for the hidden phone controls.
- `app/src/main/assets/app.js` — clock mode, mission selection, lifecycle coordination, authentic DSKY channel/relay decoding, key routing, and the base relay model.
- `app/src/main/assets/app-refine.js` — narrow post-load relay/V35 refinements plus read-only relay/render diagnostics used by device smokes; it is not intended to become a second app implementation.
- `app/src/main/assets/agc-core.js` — offline yaAGC WASM loader, minimal WASI shim, rope loading, CPU stepping, packet I/O.
- `app/src/main/java/org/apollo/agcdsky/MainActivity.java` — immersive interactive WebView shell and Activity/WebView lifecycle coordination.
- `app/src/main/java/org/apollo/agcdsky/AgcDreamService.java` — Android screen saver shell.
- `app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java` — resizable native EL-only home-screen widget renderer/scheduler.
- `app/src/main/res/layout/el_widget.xml` — single-ImageView widget layout.
- `app/src/main/res/xml/el_widget_info.xml` — AppWidget resize/update metadata.
- `app/src/main/java/org/apollo/agcdsky/NetClient.java` — local HTTPS-to-AssetManager resource server.
- `vendor/webAGC` — pinned upstream core/rope submodule.
- `tools/build-local.sh` — deterministic local source build entrypoint.
- `tools/el-widget-smoke.js` — EL-only widget source/resource policy gate.
- `tools/verify-apk.sh` — post-build APK asset/manifest/signature verification.
- `tools/wasm-runtime-smoke.js` — real pinned yaAGC/rope Node runtime preflight and V35 relay semantic gate.
- `tools/device-v35-smoke.js` — end-to-end relay/render/annunciator V35 Android WebView gate.
- `tools/device-smoke.sh` — immediate ADB install/launch/frontend-readiness diagnostic smoke.
- `docs/LOCAL_BUILD.md` — exact local build requirements and verification gates.
- `docs/DSKY_RELAY_TIMING.md` — source-backed relay topology, timing, and V35 model.
- `docs/PROGRESS.md` — live implementation/verification status and next checkpoint.
- `AGENTS.md` — durable instructions for coding agents continuing the work.
- `docs/IMPLEMENTATION_NOTES.md` — design/build history.
- `docs/REFERENCES.md` — Apollo/VirtualAGC/CuriousMarc references.

## Android Studio / Gradle build

Compatibility for the currently declared Android Gradle Plugin 9.3.0:

- JDK 17 or newer compatible runtime
- Node.js **18 or newer**
- Gradle **9.5.0 or newer stable compatible release**
- compile/target SDK 37
- SDK Build Tools **36.0.0 exactly**
- initialized Git submodules at the exact pinned revision

Set `ANDROID_SDK_ROOT` or `ANDROID_HOME`, then use the repository build entrypoint:

```bash
git submodule update --init --recursive
bash tools/build-local.sh
```

That path syntax-checks all helper scripts, runs the source/relay/refinement/widget tests, executes the real pinned yaAGC WASM with both actual ropes under Node, verifies the exact pinned webAGC checkout and binary blobs, builds from a clean app build tree, then verifies packaged frontend/binaries, merged APK metadata/permissions, debug status, and APK signature. See `docs/LOCAL_BUILD.md` for details.

A passing build is still not proof that the current AGC runtime or widget works on Android. The preferred device checkpoint is:

```bash
bash tools/device-full-smoke.sh app/build/outputs/apk/debug/app-debug.apk
```

Do not report v0.17 as runtime-verified until the corresponding current APK has actually passed the relevant Android checks.

## Historical APK

`releases/AGC-DSKY-Android-v6.apk` predates the onboard-core work. It does **not** represent the current v0.17 source and should not be used to evaluate AGC mode or the widget.

## Signing

The private v5/v6 signing key is intentionally **not committed**. Any build signed with a different key cannot update an installation signed by the old key. Keep signing keys outside the repository.

## GitHub Actions

No GitHub Actions workflow is enabled. Per project-owner instruction, builds are local/manual; do not add or use GitHub Actions unless that instruction is explicitly reversed.

## License

Android/frontend code in this repository is GPL-2.0. See `THIRD_PARTY.md` for upstream/core and DSKY EL-geometry attribution and licensing notes.
