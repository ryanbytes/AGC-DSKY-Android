# AGC DSKY Android

Android Apollo Block II DSKY clock/screensaver plus onboard AGC emulator project. Source development is currently at **v0.7**.

## Current source state

The v0.7 source integrates a pinned real VirtualAGC `yaAGC` WebAssembly core and Apollo 11 flight-software rope images. The complete Android runtime path has been implemented but has **not yet been device/emulator verified from the current source revision**, so see `docs/PROGRESS.md` before treating AGC mode as proven working.

Current source features:

- Apollo Block II-inspired 19-key DSKY layout.
- Apollo 11-era LM 2×7 annunciator layout, including the two blank positions.
- Fixed-coordinate SVG electroluminescent display so digit fields cannot be independently stretched by CSS.
- Custom narrow EL segment vectors rather than a generic seven-segment font.
- `V16 N65` phone clock mode.
- `V35E` clock-mode lamp test.
- Dim mode.
- Android `DreamService` screen saver intended for charging/idle use.
- Small periodic position drift in dream mode to reduce completely static OLED content.
- Pinned `webAGC` submodule containing `yaAGC.wasm`, `Luminary099.bin`, and `Comanche055.bin`.
- Offline yaAGC WebAssembly wrapper with a minimal WASI shim.
- AGC/CLOCK mode control.
- Persistent mission selector: Apollo 11 LM **Luminary 099** or CM **Comanche 055**.
- AGC execution pauses while the normal app is hidden and resumes in place when the same WebView returns.
- Requested AGC/CLOCK mode and selected mission persist across Activity/page recreation; recreated AGC mode starts from a fresh core reset rather than pretending CPU/erasable-memory state was serialized.
- Authentic Block II DSKY output-channel decoding for numeric registers and annunciators.
- Authentic DSKY key codes back into yaAGC, including separate PRO/Proceed handling.
- `COMP ACTY` in AGC mode is tied directly to **output channel 011 octal, bit 2**. The old phone-network activity surrogate has been removed.
- Local asset interception uses URI path segments rather than substring offsets, avoiding the old diagnostic APK's request-path index crash.
- yaAGC input writes are checked for queue-full/invalid-packet failures rather than silently dropping DSKY input.
- Local builds verify the exact pinned webAGC gitlink and exact Git-blob identities of `yaAGC.wasm`, `Luminary099.bin`, and `Comanche055.bin` before packaging.

## AGC mode

The default AGC mission uses the Apollo 11 Lunar Module rope **Luminary 099**. The hidden controls can switch to the Apollo 11 Command Module rope **Comanche 055**; the selection is stored locally.

The emulator path is:

1. Android loads the DSKY page from a synthetic local HTTPS asset origin.
2. `agc-core.js` loads packaged `yaAGC.wasm` and supplies its four WASI imports locally.
3. The selected packaged rope (`Luminary099.bin` or `Comanche055.bin`) is copied into yaAGC fixed memory with `set_fixed()`.
4. yaAGC's lazily initialized I/O ring buffers are primed, the CPU is reset back to the true mission reset state, and DSKY input masks are then queued.
5. The CPU is stepped at approximately real AGC timing while the normal app is visible.
6. `packet_read()` output drives the DSKY.
7. DSKY key presses are sent back through checked `packet_write()` calls.

Implemented DSKY channels include:

- `010` octal — display relay words and six annunciators.
- `011` octal — COMP ACTY and UPLINK ACTY.
- `0163` octal — yaAGC's modulated DSKY caution/blink states.
- `015` octal — normal DSKY keyboard input.
- `032` octal — PRO/Proceed discrete input.

See `docs/PROGRESS.md` for the exact verification status and known risks.

## Clock / screen saver

Android uses a `DreamService` for system screen savers. After installing a verified APK:

1. Open Android **Screen saver** settings.
2. Select **AGC DSKY Clock** / AGC DSKY as the screen saver.
3. Set the system start condition to **While charging**.

Dream mode remains a separate display-only phone clock rather than running the AGC core continuously. It uses independent DIM/BRIGHT/SOLAR dream brightness behavior and periodic pixel drift. Returning to the normal app does not intentionally switch the normal app into Dream/clock presentation.

## Repository checkout

The emulator core and rope binaries are supplied by a pinned Git submodule, so clone recursively:

```bash
git clone --recurse-submodules <repository-url>
```

For an existing clone:

```bash
git submodule update --init --recursive
```

A checkout without the submodule does not contain the AGC binary assets required by v0.7.

## Source layout

- `app/src/main/assets/index.html` — DSKY structure and fixed EL SVG coordinate system.
- `app/src/main/assets/style.css` — physical faceplate, annunciators, keys, display treatment.
- `app/src/main/assets/controls-layout.css` — wrapping behavior for the hidden phone controls.
- `app/src/main/assets/app.js` — clock mode, mission selection, lifecycle coordination, authentic DSKY channel/relay decoding, key routing.
- `app/src/main/assets/agc-core.js` — offline yaAGC WASM loader, minimal WASI shim, rope loading, CPU stepping, packet I/O.
- `app/src/main/java/org/apollo/agcdsky/MainActivity.java` — immersive interactive WebView shell and Activity/WebView lifecycle coordination.
- `app/src/main/java/org/apollo/agcdsky/AgcDreamService.java` — Android screen saver shell.
- `app/src/main/java/org/apollo/agcdsky/NetClient.java` — local HTTPS-to-AssetManager resource server.
- `vendor/webAGC` — pinned upstream core/rope submodule.
- `tools/build-local.sh` — deterministic local source build entrypoint.
- `tools/verify-apk.sh` — post-build APK asset/manifest/signature verification.
- `docs/LOCAL_BUILD.md` — exact local build requirements and verification gates.
- `docs/PROGRESS.md` — live implementation/verification status and next checkpoint.
- `AGENTS.md` — durable instructions for coding agents continuing the work.
- `docs/IMPLEMENTATION_NOTES.md` — design/build history.
- `docs/REFERENCES.md` — Apollo/VirtualAGC/CuriousMarc references.

## Android Studio / Gradle build

Compatibility for the currently declared Android Gradle Plugin 9.3.0:

- JDK 17 or newer compatible runtime
- Gradle **9.5.0 or newer compatible 9.x release** (AGP 9.3.0 minimum is 9.5.0)
- compile/target SDK 37
- SDK Build Tools 36.0.0 or compatible newer installed build tools
- initialized Git submodules at the exact pinned revision

Set `ANDROID_SDK_ROOT` or `ANDROID_HOME`, then use the repository build entrypoint:

```bash
git submodule update --init --recursive
bash tools/build-local.sh
```

That path runs the JavaScript source smoke tests when Node is available, verifies the exact pinned webAGC checkout and binary blobs, builds the debug APK, then verifies the packaged assets, merged manifest, and APK signature. See `docs/LOCAL_BUILD.md` for details.

A passing build is still not proof that the current AGC runtime works on Android. Do not report v0.7 as runtime-verified until the resulting APK has actually been installed and exercised on an Android device/emulator.

## Historical APK

`releases/AGC-DSKY-Android-v6.apk` predates the onboard-core work. It does **not** represent the current v0.7 source and should not be used to evaluate AGC mode.

## Signing

The private v5/v6 signing key is intentionally **not committed**. Any build signed with a different key cannot update an installation signed by the old key. Keep signing keys outside the repository.

## GitHub Actions

No GitHub Actions workflow is enabled. Per project-owner instruction, builds are local/manual; do not add or use GitHub Actions unless that instruction is explicitly reversed.

## License

Android/frontend code in this repository is GPL-2.0. See `THIRD_PARTY.md` for upstream/core attribution and licensing notes.
