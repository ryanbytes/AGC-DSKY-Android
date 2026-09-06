# AGC DSKY Android

Android Apollo Block II DSKY clock/screensaver plus onboard AGC emulator project.

## Current direction

The normal interactive app now treats the **Command Module as the default spacecraft** and couples the selected spacecraft to its Apollo 11 flight software:

- **CM** → Comanche 055
- **LM** → Luminary 099

The shared Block II DSKY remains common to both modes. The main app keeps that DSKY centred in the phone viewport and aligns a separate CM or LM installation scene to the exact 320×372 DSKY rectangle. Rotation/aspect-ratio changes therefore alter only the surrounding panel crop; they do not stretch or move the DSKY relative to its spacecraft panel.

The surrounding panel renderer is under active fidelity iteration. v0.31 replaces the flat diagram-like hardware pass with layered dimensional SVG hardware: recessed panel faces, physical toggle sockets/levers/guards, framed talkbacks, dimensional pushbuttons/knobs/fasteners, glassed analog meters, a shaded FDAI ball, and darker textured Apollo panel finishes. This remains a reconstruction driven by Apollo documentation and must still be checked against target-device screenshots before being treated as final visual fidelity.

## Current source state

Current source features include:

- Apollo Block II-inspired 19-key DSKY layout.
- Apollo 11-era LM 2×7 annunciator layout, including the two blank positions.
- Fixed-coordinate SVG electroluminescent display so digit fields cannot be independently stretched by CSS.
- Custom narrow EL segment vectors rather than a generic seven-segment font.
- Resizable Android home-screen widget that renders **only the 106×190 EL display section**: no faceplate/bezel, screws, keyboard, annunciator bank, app controls, or Dreaming-mode chrome.
- `V16 N65` phone clock mode.
- Source-backed `V35E` clock-mode light test using the channel-010 relay model rather than direct all-8 DOM painting.
- Dim mode.
- Android `DreamService` screen saver intended for charging/idle use.
- Small periodic position drift in dream mode to reduce completely static OLED content.
- Pinned `webAGC` submodule containing `yaAGC.wasm`, `Luminary099.bin`, and `Comanche055.bin`.
- Offline yaAGC WebAssembly wrapper with a minimal four-function WASI shim.
- AGC/CLOCK mode control.
- Persistent mission selector: Apollo 11 CM **Comanche 055** or LM **Luminary 099**.
- AGC execution pauses while the normal app is hidden and resumes in place when the same WebView returns.
- Authentic Block II DSKY output-channel decoding for numeric registers, signs, and annunciators.
- Authentic DSKY key codes back into yaAGC, including separate press-and-hold PRO/Proceed handling.
- `COMP ACTY` in AGC mode tied directly to output channel 011 octal, bit 2.
- One shared channel-010 selector/sign topology for authentic AGC decoding and the synthetic clock relay encoder.
- Local builds verify the exact pinned webAGC gitlink and exact Git-blob identities of `yaAGC.wasm`, `Luminary099.bin`, and `Comanche055.bin` before packaging.
- Relay audio uses a fully synthesized short high-frequency mechanical click rather than sampled audio, and is suppressed in DreamService/hidden WebViews.

## AGC mode

The default AGC mission is now the Apollo 11 Command Module rope **Comanche 055**. The hidden controls can switch to the Apollo 11 Lunar Module rope **Luminary 099**; the selection is stored locally and also selects the matching spacecraft-panel scene.

The emulator path is:

1. Android loads the DSKY page from a synthetic local HTTPS asset origin.
2. `agc-core.js` loads packaged `yaAGC.wasm` and supplies its four WASI imports locally.
3. The selected packaged rope (`Comanche055.bin` or `Luminary099.bin`) is copied into yaAGC fixed memory with `set_fixed()`.
4. yaAGC I/O buffers are primed and the CPU is reset to the selected mission reset state.
5. The CPU is stepped at approximately real AGC timing while the normal app is visible.
6. `packet_read()` output drives DSKY relay/lamp state.
7. DSKY key presses are sent back through checked `packet_write()` calls.

Implemented DSKY channels include:

- `010` octal — display relay words and condition annunciators.
- `011` octal — COMP ACTY and UPLINK ACTY.
- `0163` octal — yaAGC modulated DSKY caution/blink states.
- `015` octal — normal DSKY keyboard input.
- `032` octal — PRO/Proceed discrete input.

### CM-mode fidelity note

The pinned upstream WASM engine defaults its internal `CmOrLm` global to LM and does not expose a WASM setter. `Comanche055.bin` is still the exact pinned CM rope and is exercised by the real-WASM preflight, but **full CM peripheral-mode fidelity is not currently claimed**. In the ring-buffer path used by webAGC, the known mode-dependent branch is LM rotational-hand-controller bookkeeping on channel `013`; this app does not provide RHC inputs.

## Clock / screen saver

Android uses a `DreamService` for system screen savers. Dream mode remains a separate display-only phone clock rather than running the AGC core continuously. It uses independent DIM/BRIGHT/SOLAR dream brightness behavior and periodic pixel drift.

## Home-screen EL widget

The home-screen widget is intentionally narrower than either the normal app or DreamService: it is the EL section itself. It preserves the WebView display's 106×190 coordinate system and contains only `COMP ACTY`, `PROG`, `VERB`, `NOUN`, the three register separators, and the three signed register fields.

## Repository checkout

The emulator core and rope binaries are supplied by a pinned Git submodule, so clone recursively:

```bash
git clone --recurse-submodules <repository-url>
```

For an existing clone:

```bash
git submodule update --init --recursive
```

## Source layout

- `app/src/main/assets/index.html` — DSKY structure and fixed EL SVG coordinate system.
- `app/src/main/assets/style.css` — DSKY faceplate, annunciators, keys, display treatment.
- `app/src/main/assets/spacecraft-panels.js` — CM/LM DSKY-centred installation geometry and dimensional hardware drawing.
- `app/src/main/assets/spacecraft-panels.css` — CM/LM panel materials, hardware depth and shading.
- `app/src/main/assets/app.js` — clock mode, mission selection, lifecycle coordination, DSKY channel/relay decoding and key routing.
- `app/src/main/assets/agc-core.js` — offline yaAGC WASM loader, WASI shim, rope loading, CPU stepping and packet I/O.
- `app/src/main/java/org/apollo/agcdsky/MainActivity.java` — immersive interactive WebView shell.
- `app/src/main/java/org/apollo/agcdsky/AgcDreamService.java` — Android screen saver shell.
- `app/src/main/java/org/apollo/agcdsky/ElWidgetProvider.java` — resizable native EL-only home-screen widget renderer/scheduler.
- `vendor/webAGC` — pinned upstream core/rope submodule.
- `tools/build-local.sh` — deterministic local source build entrypoint.

## Android Studio / Gradle build

Current declared build requirements:

- JDK 17 or newer compatible runtime
- Node.js 18 or newer
- Gradle compatible with the declared Android Gradle Plugin
- compile/target SDK 37
- SDK Build Tools 36.0.0 exactly
- initialized Git submodules at the exact pinned revision

Set `ANDROID_SDK_ROOT` or `ANDROID_HOME`, then use:

```bash
git submodule update --init --recursive
bash tools/build-local.sh
```

A passing build is not proof that current AGC runtime, widget, or spacecraft-panel presentation works correctly on the target Android device. Device screenshot/runtime gates remain required before final merge.

## Signing

The private historical signing key is intentionally not committed. Any build signed with a different key cannot update an installation signed by the old key.

## GitHub Actions

No GitHub Actions workflow is enabled. Builds remain local/manual unless the project owner explicitly changes that requirement.

## License

Android/frontend code in this repository is GPL-2.0. See `THIRD_PARTY.md` for upstream/core and DSKY EL-geometry attribution and licensing notes.
