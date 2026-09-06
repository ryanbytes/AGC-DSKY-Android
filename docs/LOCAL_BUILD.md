# Local Android build and verification

The AGC DSKY APK is intentionally built and verified locally. Do not add or use GitHub Actions, Codespaces, or another hosted build service for this project.

## Required toolchain

The repository currently pins Android Gradle Plugin 9.3.0 and `compileSdk 37`.

Required toolchain:

- JDK 17 or newer compatible with AGP 9.3
- Node.js 18 or newer
- Android SDK platform 37, including `platforms/android-37/android.jar`
- Android SDK Build Tools **36.0.0 exactly**
- Android SDK Platform Tools / `adb` for device testing
- Git with the `vendor/webAGC` submodule initialized
- `curl` or `wget`, `unzip`, and `sha256sum` or `shasum` only when the Gradle bootstrap fallback is needed

A separate Gradle install is **not required**. `tools/build-local.sh` prefers a stable system Gradle 9.5.0 or newer when one is already present. Otherwise it invokes `tools/gradle-bootstrap.sh`, which downloads official Gradle **9.5.1**, verifies SHA-256

```text
bafc141b619ad6350fd975fc903156dd5c151998cc8b058e8c1044ab5f7b031f
```

and caches the extracted distribution under `${GRADLE_USER_HOME:-$HOME/.gradle}/agc-bootstrap`. The bootstrap only supplies a local Gradle executable; it does not move the build to hosted infrastructure.

The repository does not contain a guessed/reconstructed wrapper JAR. If a standard wrapper is later committed, generate it from a trusted Gradle distribution and verify it against Gradle's published wrapper checksum.

The build/verification shell scripts intentionally avoid GNU-only version/file-listing features and are intended to run under the Bash/BSD userland commonly present on macOS.

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

`tools/build-local.sh` refuses to build if `vendor/webAGC` is at another revision or has local modifications. The pinned checkout must provide:

- `vendor/webAGC/src/yaAGC.wasm`
- `vendor/webAGC/demo/agc/Luminary099.bin`
- `vendor/webAGC/demo/agc/Comanche055.bin`

## Build

Set either `ANDROID_SDK_ROOT` or `ANDROID_HOME`, then run:

```bash
git submodule update --init --recursive
bash tools/build-local.sh
```

The script performs these gates in order:

1. Requires a clean committed Git revision and verifies JDK 17+ / Node.js 18+.
2. Uses an installed stable Gradle 9.5.0+ or checksum-verified local Gradle 9.5.1.
3. Verifies Android platform 37 and exact Build Tools 36.0.0, including `aapt2` and `apksigner`.
4. Verifies `vendor/webAGC` is the exact pinned clean checkout and all three binary inputs are present.
5. Syntax-checks every `tools/*.sh` with Bash and every `tools/*.js` with `node --check`.
6. Runs policy/CSP/frontend/display/**EL-widget**/SOLAR/AGC-wrapper/runtime-debug/native-diagnostic source smokes.
7. Runs `tools/app-refine-smoke.js`, guarding V35 input isolation, RSET/transition cleanup, relay-8 FULLDSP physical state, and immutable relay diagnostics.
8. Runs `tools/dsky-mapping-smoke.js` and `tools/v35-model-smoke.js`, including the effective `app.js` + `app-refine.js` relay model.
9. Runs asset-reference checks.
10. Runs `tools/wasm-runtime-smoke.js` against the **real pinned yaAGC WASM and both real ropes**. It requires the `V37E00E` P00 precondition to reach channel-010 PROG `00` / relay-11 low-11 `01265`, then requires a real `V35E` FULLDSP/FULLDSP1 relay response.
11. Runs clean `:app:clean`, `:app:verifyPinnedAgcAssets`, and `:app:assembleDebug` with stacktraces enabled.
12. Runs `tools/verify-apk.sh` against the produced APK, including merged EL AppWidget receiver/class/resource checks.

The expected debug APK is:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## EL home-screen widget source invariant

`tools/el-widget-smoke.js` treats the owner's widget requirement as a build policy, not a visual suggestion. The home-screen widget must be the EL readout itself.

The source gate requires:

- one zero-padding `ImageView` as the entire widget layout;
- the native renderer's `106 x 190` EL coordinate system;
- `PROG`, `VERB`, `NOUN`, signed registers, and EL separator rules;
- horizontally and vertically resizable AppWidget metadata;
- no INTERNET permission;
- a non-wakeup `AlarmManager.RTC` minute scheduler rather than an exact/wakeup alarm;
- no `drawRect`, `drawRoundRect`, `drawCircle`, or `drawOval` primitives in the widget renderer, preventing a bezel/faceplate/fastener layer from being quietly reintroduced.

The actual segment polygons come from the same crew-facing Ben Krasnow `DSKY V2.svg` EL geometry used by the WebView DSKY. This is a native AppWidget because Android home-screen widgets require a native `RemoteViews` surface; it does not create a second AGC implementation.

## Relay/V35 source invariants

The source and Node smokes now guard more than rendered appearance.

Channel `010` uses the Block II selector/B-sign/C/D five-relay matrix. The synthetic clock encoder and authentic AGC decoder share one topology. Invalid five-bit character patterns are rejected rather than converted to blank.

Luminary V35 source constants imply these channel-010 low-11 states:

- ordinary numeric selectors: `01675`
- R1/R2/R3 plus selectors 7/5/2: `03675`
- relay 12 Apollo-11 LM condition lights: `00674`

`FULLDSP` drives both physical five-relay character banks to digit code `035` even on selector 8, although selector 8's C bank is not connected to a visible numerical position. The model and semantic gates retain that physical state.

The V35 model also keeps:

- five-second light-test duration
- UPLINK/TEMP/KEY REL/VN FLASH/OPR ERR test behavior
- RESTART/STBY via TEST ALARM handling
- COMP ACTY governed by actual channel `011` bit 2 in real AGC mode rather than a fixed V35 assumption
- yaAGC-compatible 1.28-second / 75% V/N + KEY REL/OPR ERR modulation

## Other source/runtime invariants

The pre-build checks also guard:

- no `android.permission.INTERNET`
- Android backup disabled for local-only app/WebView state
- WebView metrics collection opted out
- both WebViews explicitly block network loads and disable file/content access
- geolocation restricted to the packaged synthetic HTTPS origin
- top-level navigation restricted to packaged `/assets/` content
- local WebView responses use explicit `200 OK`, `Cache-Control: no-store`, and MIME-sniffing protection
- strict offline CSP with `'wasm-unsafe-eval'`, not ordinary `'unsafe-eval'` or inline script
- required script order: `runtime-debug.js` -> `agc-core.js` -> `app.js` -> `app-refine.js`
- CSP violations and stack-bearing runtime failures reach the local private debug reporter
- `FRONTEND READY` is withheld until EL glyphs, mission UI, and `app-refine.js` relay diagnostics are all initialized
- display-only crop/scaling geometry remains tied to the intended upper DSKY region
- DREAM SOLAR sunrise/sunset, transition midpoint, polar day, and polar night behavior
- only the exact three pinned upstream binary inputs are staged
- mission selection/requested AGC mode persistence
- DreamService does not start yaAGC
- Activity and DreamService remain in the same default process for shared same-origin WebStorage
- rope load -> disposable I/O initialization -> final reset -> DSKY U-bit mask sequencing
- DSKY packet-write failures route through the AGC error handler
- PRO remains true press-and-hold and is released on cancel, visibility loss, mission switch, and mode exit
- pinned WASM imports exactly `env.memory` plus WASI `fd_close`, `fd_fdstat_get`, `fd_seek`, and `fd_write`
- Luminary099 and Comanche055 use separate real WASM instances/memories in the host preflight

These checks reduce source/packaging risk but do not substitute for Android WebView/device testing.

## Known CM/LM emulator-mode limitation

The pinned webAGC/yaAGC WASM engine contains upstream `CmOrLm` with default value `0` (LM) and does not export a setter. Desktop VirtualAGC changes this through CLI/configuration code not used by this WebAssembly wrapper.

For the current DSKY-focused Android scope:

- `Luminary099.bin` runs with the native/default LM mode.
- `Comanche055.bin` is still the exact pinned CM rope and is exercised by the real-WASM smoke.
- The known ring-buffer path mode-dependent behavior involves LM rotational-hand-controller bookkeeping on channel `013`; this app supplies no RHC inputs.
- Therefore CM DSKY execution is retained, but **full CM peripheral-mode fidelity is not claimed**.

Do not binary-patch the pinned WASM to change the flag. If exact CM peripheral behavior becomes required, rebuild audited yaAGC source with an explicit exported LM/CM configuration API and pin/verify the resulting binary separately.

## APK verification

`tools/verify-apk.sh` independently checks the built archive. It requires `unzip`, `git`, `cmp`, ordinary POSIX/BSD `grep`/`sed`, and exact Build Tools 36.0.0 `aapt2`/`dexdump`/`apksigner`.

It verifies:

- package `org.apollo.agcdsky`, with versionCode/versionName parsed from the current `app/build.gradle`, minSdk `26`, targetSdk `37`
- debuggable status required by the ADB `run-as`/WebView inspection path
- required coarse/fine location permissions for SOLAR
- no INTERNET permission
- exact size/Git blob of packaged `yaAGC.wasm`, `Luminary099.bin`, and `Comanche055.bin`
- packaged `index.html` matches source
- **every local `src=`/`href=` asset referenced by current `index.html` is discovered dynamically and byte-compared against the checkout**; this prevents a new required script such as `app-refine.js` from being silently omitted from the verifier's file list
- `BUILD_SOURCE.txt` matches source
- known unused upstream vendor trees/files are absent
- merged manifest contains `ElWidgetProvider`, `APPWIDGET_UPDATE`, and appwidget-provider metadata
- resource table contains `id/el_widget_image`, `layout/el_widget`, and `xml/el_widget_info`
- merged DEX contains `org.apollo.agcdsky.ElWidgetProvider`
- APK signature verifies with `apksigner`

## Immediate and full device smoke

With exactly one authorized Android/GrapheneOS device connected over ADB, the preferred current-source acceptance command is:

```bash
bash tools/device-full-smoke.sh app/build/outputs/apk/debug/app-debug.apk
```

The first layer, `tools/device-smoke.sh`:

1. Refuses ambiguous multiple-device setups.
2. Installs with `adb install -r` without auto-uninstalling on signature mismatch.
3. Preserves app state and clears only stale private debug evidence.
4. Launches `MainActivity`, captures logcat/private diagnostics, and confirms the process remains alive.
5. Requires debug-only `FRONTEND READY app` **after the full script stack, including relay diagnostic refinement, has initialized**. A blank/partial/base-only frontend does not pass.

The subsequent WebView/AGC layers use the real app process and real `AgcCore`; no mock core is injected. Current checks include:

- real Luminary099 and Comanche055 startup with yaAGC version/output evidence
- ordinary VERB pointer input
- held PRO pointer-down/release
- same-WebView pause/resume core identity
- Luminary `V37E00E` through actual pointer handlers, with a required channel-driven PROG `00` / relay-11 low-11 `01265` precondition
- real `V35E` exact relay-latch state: `01675` ordinary numeric rows, `03675` plus rows, relay 8 `01675`, relay 12 `00674`
- rendered PROG/VERB/NOUN `88` and R1/R2/R3 `+88888`
- V35 steady annunciators checked against the actual decoded relay/channel state, including COMP ACTY == contemporaneous channel `011` bit `00002`
- observed yaAGC-modulated V/N + KEY REL/OPR ERR off phase while V35 relay latches/steady lamps persist
- packaged-page reload restoring CM mission/requested AGC mode on a newly constructed core
- actual process destruction with `adb shell am force-stop`, observed no-process interval, relaunch, and persisted CM/AGC preferences on a fresh process/core
- best-effort restoration of the user's pre-smoke mission/run-mode preferences

See `docs/DEVICE_RUNTIME_SMOKE.md` for exact proof boundaries. Adding or strengthening a script is not evidence it passes; output must be captured from a current APK built from the corresponding source revision.

## Debug WebView inspection

The debug APK enables WebView inspection only when Android marks the app debuggable. Release/non-debuggable builds do not enable it.

While the current debug APK runs on an ADB-connected device, desktop Chrome/Chromium inspection can verify the local page, packaged WASM/rope fetches, absence of external requests, and console/CSP/runtime errors. The automated device tools use the same real DevTools target programmatically.

## Remaining physical/manual gates

Even a passing full-device smoke does not prove every user-visible behavior. Remaining acceptance work includes:

- pixel-perfect physical-screen inspection of digits, signs, lamps, and annunciators
- EL home-screen widget picker appearance, EL-only rendering, resize behavior, tap-to-open, and minute/timezone refresh on the target launcher
- real OS screen-off/screen-on behavior beyond the direct lifecycle bridge
- long physical PRO hold for intended standby semantics
- DreamService selection/startup/non-interactivity through Android UI
- physical DREAM DIM / BRIGHT / SOLAR brightness and first-use location-permission behavior
- portrait/landscape DISPLAY cropping/scaling on the target phone
- representative Pinball semantics beyond the automated V35 sequence

A passing build/verification/full-device sequence is the point at which current-source runtime claims can be upgraded from implemented to verified.
