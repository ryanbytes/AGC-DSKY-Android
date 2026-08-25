# Local Android build and verification

The AGC DSKY APK is intentionally built and verified locally. Do not add or use GitHub Actions, Codespaces, or another hosted build service for this project.

## Required toolchain

The repository currently pins Android Gradle Plugin 9.3.0 and `compileSdk 37`.

Required toolchain:

- JDK 17 or newer compatible with AGP 9.3
- Node.js 18 or newer
- Gradle 9.5.0 or newer
- Android SDK platform 37, including `platforms/android-37/android.jar`
- Android SDK Build Tools **36.0.0 exactly**
- Android SDK Platform Tools / `adb` for device testing
- Git with the `vendor/webAGC` submodule initialized

The repository does not currently contain a Gradle wrapper. Do not add a guessed or reconstructed `gradle-wrapper.jar`; generate/add the official wrapper only from a trusted Gradle distribution.

The build/verification shell scripts intentionally avoid GNU-only utilities such as `sort -V` and GNU `find -printf`; they are intended to run under the Bash/BSD userland commonly present on macOS.

## Checkout

For a fresh checkout:

```bash
git clone --recurse-submodules <repository-url>
cd AGC-DSKY-Android
```

For an existing clone:

```bash
git submodule update --init --recursive
```

The submodule gitlink is pinned to:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

`tools/build-local.sh` refuses to build if `vendor/webAGC` is at another revision or has local modifications. The pinned checkout must provide all three binary inputs:

- `vendor/webAGC/src/yaAGC.wasm`
- `vendor/webAGC/demo/agc/Luminary099.bin`
- `vendor/webAGC/demo/agc/Comanche055.bin`

## Build

Set either `ANDROID_SDK_ROOT` or `ANDROID_HOME`, then run:

```bash
bash tools/build-local.sh
```

The script performs these gates in order:

1. Verifies JDK 17 or newer and Node.js 18 or newer.
2. Verifies stable Gradle 9.5.0 or newer.
3. Verifies Android platform 37 and exact Build Tools 36.0.0, including `aapt2` and `apksigner`.
4. Verifies `vendor/webAGC` is the exact pinned clean checkout.
5. Verifies the recursive webAGC binary inputs are present.
6. Syntax-checks every repository shell helper with Bash.
7. Runs all dependency-free JavaScript/source smoke tests.
8. Runs `tools/wasm-runtime-smoke.js`, which instantiates the **real pinned yaAGC WASM** under Node, validates its complete import/export contract, loads both real ropes, executes CPU cycles and DSKY input paths, and proves LM/CM runs use distinct WASM instances and memories.
9. Runs a clean Android build beginning with `:app:clean` and `:app:verifyPinnedAgcAssets`.
10. Runs `:app:assembleDebug` with Gradle stacktraces enabled for useful first-build diagnostics.
11. Runs `tools/verify-apk.sh` against the produced APK.

The expected debug APK is:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Source/runtime invariants checked before the Android build

The source and Node smoke tests currently guard properties that should not regress silently:

- no `android.permission.INTERNET`
- Android backup disabled for local-only app/WebView state
- WebView metrics collection opted out
- both WebViews explicitly block network loads
- both WebViews disable `file://` and `content://` access
- geolocation is restricted to the packaged synthetic HTTPS origin
- top-level WebView navigation is restricted to packaged `/assets/` content
- packaged WebView responses are explicit local `200 OK` responses with `Cache-Control: no-store` and MIME sniffing disabled
- only the exact three pinned upstream binary inputs are staged into generated Android assets
- mission selection and requested AGC mode persist as designed
- DreamService does not start yaAGC
- Activity and DreamService remain in the same default process so their same-origin WebStorage state is shared
- yaAGC loader wiring performs rope load, disposable I/O initialization, final CPU reset, then DSKY U-bit mask setup
- user DSKY packet-write failures are routed through the AGC error handler rather than silently dropped
- PRO supports authentic press-and-hold behavior and is forcibly released on pointer cancel, visibility loss, mission switch, and mode exit
- unhandled JavaScript errors, handled stack-bearing AGC errors, and native WebView resource failures are routed to the local private debug reporter
- the pinned real WASM imports exactly `env.memory` plus WASI `fd_close`, `fd_fdstat_get`, `fd_seek`, and `fd_write`, matching the app's minimal WASI shim
- both Luminary099 and Comanche055 instantiate and execute against the real pinned WASM under Node before Gradle starts

These checks significantly reduce source/packaging risk but do not substitute for Android WebView and device testing.

## Known CM/LM emulator-mode limitation

The pinned webAGC/yaAGC WASM engine contains the upstream `CmOrLm` global with its default value of `0` (LM), and its exported WASM API does not expose a setter for that global. Desktop VirtualAGC normally changes this through its CLI/configuration layer, which the WebAssembly wrapper does not run.

For the current DSKY-only Android scope:

- `Luminary099.bin` runs with the emulator's native/default LM mode.
- `Comanche055.bin` is still loaded as the exact pinned CM rope and is exercised by the real-WASM smoke.
- In the ring-buffer peripheral path used by webAGC, the known `CmOrLm`-dependent branch is LM rotational-hand-controller bookkeeping associated with channel `013`. This Android app does not provide RHC inputs.
- Therefore CM DSKY execution is retained, but **full CM peripheral-mode fidelity is not claimed**.

Do not patch the pinned WASM binary in place merely to change this flag. If exact CM peripheral behavior becomes required, rebuild yaAGC from audited VirtualAGC source with an explicit exported LM/CM configuration API, then pin and verify that new binary separately.

## APK verification

`tools/verify-apk.sh` independently checks the built archive, not just the source tree. It requires `unzip`, `git`, `cmp`, and exact Build Tools 36.0.0 `aapt2`/`apksigner` from the configured Android SDK.

It verifies:

- package `org.apollo.agcdsky`, versionCode `7`, versionName `0.7`, minSdk `26`, targetSdk `37`
- the APK is debuggable, as required by the ADB `run-as` test path
- required coarse/fine location permissions remain present for SOLAR
- packaged `assets/yaAGC.wasm` is 132,617 bytes and Git blob `713685680492098d05437b99c26403f683d56009`
- packaged `assets/Luminary099.bin` is 73,728 bytes and Git blob `cd2ec9992d5863e1c7234fa760020f68ef946202`
- packaged `assets/Comanche055.bin` is 73,728 bytes and Git blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`
- packaged frontend files match the current checkout byte-for-byte
- known unused upstream vendor files are absent
- the merged APK manifest does not request `android.permission.INTERNET`
- the APK signature verifies with `apksigner`

## Immediate device smoke

With one authorized Android/GrapheneOS device connected over ADB, run:

```bash
bash tools/device-smoke.sh
```

or pass an explicit APK path:

```bash
bash tools/device-smoke.sh /path/to/app-debug.apk
```

The script:

1. Refuses ambiguous multiple-device ADB setups.
2. Installs with `adb install -r`.
3. Does **not** auto-uninstall on a signing-key mismatch, because uninstalling would erase app state.
4. Force-stops the app and clears only the stale private `files/debug-last.txt`; preferences, WebView storage, mission selection, and saved SOLAR coordinates are preserved.
5. Clears logcat and launches `MainActivity` with `am start -W`.
6. Confirms the app process remains alive after launch.
7. Requires a debug-only native `FRONTEND READY app` marker emitted only after `app.js` has initialized `AGCDSKY` and rendered EL glyphs. A process that survives with a blank or partially initialized WebView therefore fails.
8. Captures logcat to `app/build/device-smoke/logcat.txt`.
9. Uses `run-as` on the debuggable APK to retrieve `files/debug-last.txt` if the app produced a local native/WebView/JavaScript report.
10. Preserves both evidence files even if the app dies immediately.

A pass here proves the freshly verified APK installs and its normal-app frontend completes initial WebView initialization. It does not yet prove live AGC mission execution on Android.

## Debug WebView inspection

The debug APK enables `WebView.setWebContentsDebuggingEnabled(true)` only when Android marks the application debuggable. Release/non-debuggable builds do not enable it.

While the debug APK is running on an ADB-connected device, desktop Chrome/Chromium `chrome://inspect` can inspect the app WebView. This is useful for verifying:

- `https://appassets.androidplatform.net/assets/index.html` is the live main page
- `yaAGC.wasm` fetch succeeds with the packaged `application/wasm` response
- the selected `Luminary099.bin` or `Comanche055.bin` fetch succeeds
- no external network requests occur
- console/runtime errors match the app-local debug report

## Manual runtime gates after the immediate smoke

A passing build plus immediate device smoke still does not prove the AGC runtime. Manually verify at minimum:

- entering AGC mode instantiates the real packaged WASM and starts the selected rope
- real channel `010` output populates PROG/VERB/NOUN/R1/R2/R3
- COMP ACTY follows channel `011`, bit 2
- a normal DSKY key through channel `015` receives a real Pinball response
- PRO works through channel `032`, bit 14, including press-and-hold behavior for standby
- LM L99 / CM C55 mission switching loads the correct rope
- screen off/on resumes the same in-memory core when the WebView survives
- Activity/page recreation restarts the selected mission from a fresh AGC reset rather than claiming serialized CPU state
- DreamService is display-only and does not start yaAGC
- DREAM DIM / BRIGHT / SOLAR work, including first-use location permission and saved local coordinates

A passing build/verification/device sequence is the point at which current-source runtime claims can be upgraded from implemented to verified.
