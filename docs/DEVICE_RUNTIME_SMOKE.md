# Device runtime smoke

The current-source debug APK has layered device-level smoke gates. They do not replace visual/manual verification, but they turn several former manual guesses into reproducible runtime checks.

## Prerequisites

- A current debug APK built from the repository source.
- Exactly one authorized Android device visible to `adb`.
- Android SDK Platform Tools (`adb`).
- Node.js 18 or newer on the host running the smoke.
- The debug APK must remain debuggable so Android WebView exposes its local DevTools socket. Release builds intentionally do not enable WebView inspection.

## One-command gate

```bash
bash tools/device-full-smoke.sh app/build/outputs/apk/debug/app-debug.apk
```

This runs the immediate install/launch/frontend smoke, live AGC/WebView checks, page-recreation check, and finally an Android process force-stop/relaunch check.

### Immediate device smoke

`tools/device-smoke.sh`:

- calculates the APK SHA-256 and records the source commit
- installs/updates the APK without intentionally clearing app data
- launches the interactive Activity
- captures logcat and the app-private debug report
- requires the debug-only `FRONTEND READY app` marker
- rejects obvious fatal Android/WebView events

A process that merely stays alive with a blank or partially initialized WebView is not a pass.

### Live AGC runtime smoke

`tools/device-agc-smoke.sh` waits for the actual `webview_devtools_remote_*` socket belonging to the app process, forwards it with `adb`, and runs three dependency-free Chrome DevTools Protocol drivers against that same packaged WebView:

1. `tools/device-agc-smoke.js` checks core startup, both pinned missions, basic pointer input, held PRO behavior, and same-WebView pause/resume identity.
2. `tools/device-v35-smoke.js` performs the source-backed semantic Pinball light-test gate described below.
3. `tools/device-recreation-smoke.js` selects Comanche055 in AGC mode, tags the live core object, reloads the actual packaged page with DevTools `Page.reload`, and requires the persisted CM mission + requested AGC mode to re-enter on a newly constructed core object.

None of these drivers injects a mock `AgcCore`.

The general live gate checks:

- the interactive packaged frontend is initialized
- Apollo 11 LM `Luminary099.bin` can enter AGC mode
- the real yaAGC core is present, running, and reports a version
- real DSKY output channels are observed from the running core
- VERB input is delivered through the actual DSKY pointer handler without stopping the core
- PRO is asserted on pointer-down, remains visibly held, and releases on pointer-up
- an in-memory AGC instance pauses and resumes through `AGCDSKY.setAppVisible(false/true)` without being replaced
- Apollo 11 CM `Comanche055.bin` can enter AGC mode in a separate mission run
- the CM run also produces real DSKY output without an AGC error
- page recreation restores the persisted `Comanche055` mission selection
- page recreation restores requested AGC mode and starts the selected mission again
- the pre-reload core tag does not survive page recreation, proving a new JavaScript/yaAGC core object is constructed rather than presenting the old in-memory core as serialized state

The smoke snapshots the persistent mission/run-mode settings and attempts to restore them afterward. If the pre-test state was an active AGC run, restoration necessarily starts that mission from a fresh AGC reset; exact CPU/erasable-memory state is not serialized by the app.

## Relay-aware V35 semantic gate

`tools/device-v35-smoke.js` selects Luminary099, enters P00 through the real pointer sequence `V37E00E`, then enters `V35E` through the same on-screen pointer handlers.

The frontend now exposes read-only `AGCDSKY.snapshotRelays()` and `AGCDSKY.snapshotDsky()` diagnostics. They copy current state rather than exposing mutable relay tables. The V35 driver uses those diagnostics to distinguish an AGC-output error from a renderer error.

A V35 pass requires all of the following at the same visible/on phase:

- PROG `88`
- VERB `88`
- NOUN `88`
- R1 `+88888`
- R2 `+88888`
- R3 `+88888`
- channel-010 selectors 1 through 11 contain the source-backed `FULLDSP`/`FULLDSP1` low-11 relay words
- selector 8 is specifically `01675`, including the visually unused C five-relay bank that Luminary still drives during V35
- relay 12 is `00674` for the six Apollo-11 LM condition lights
- UPLINK, TEMP, NO ATT, GIMBAL LOCK, STBY, PROG, RESTART, TRACKER, ALT, and VEL are on
- KEY REL and OPR ERR are on during the visible phase
- COMP ACTY remains off
- EL power-off is not asserted
- the frontend synthetic clock-test flag is false, proving this state came from the real AGC path rather than the phone-clock V35 convenience path

The driver then waits for yaAGC's hardware-model modulation and requires an observed off phase where:

- V/N blanking is asserted
- KEY REL is off
- OPR ERR is off
- the steady V35 lamps remain on
- the same channel-010 V35 relay latches remain present

That proves the path:

`pointer input -> Pinball/Luminary099 -> yaAGC channel 010/011/0163 -> frontend relay latches -> annunciators/SVG`

It is intentionally stronger than decoding the SVG and seeing a collection of 8s.

### Why relay 8 is `01675`

Luminary 99 `VBTSTLTS` writes `FULLDSP = 05675` into every numeric `DSPTAB` entry. T4 strips the upper dirty/selector portion before channel-010 output, leaving low-11 `01675`: C=`035`, D=`035`.

Relay selector 8 connects only D to visible R1D1, so ordinary display decoding ignores its C field. V35 still energizes that unused five-relay bank. Both the synthetic relay model and the real-WASM/device semantic gates retain this physical distinction.

### Android process recreation smoke

`tools/device-process-recreation-smoke.sh` is intentionally separate from the same-WebView CDP run because `adb shell am force-stop` destroys the app process and its DevTools socket.

The process gate:

1. launches the current app and finds its real process/WebView socket
2. stores the user's original mission/run-mode preferences in temporary localStorage smoke keys
3. selects `Comanche055` and enters AGC mode
4. records the original PID
5. performs `adb shell am force-stop org.apollo.agcdsky`
6. requires `pidof` to become empty, proving the process actually disappeared rather than inferring death from a PID change
7. relaunches the Activity and discovers the new process/WebView socket
8. reconnects through CDP
9. requires the persisted smoke nonce, CM mission, requested AGC mode, a running yaAGC version, and real DSKY output channels
10. restores the user's original frontend mission/run-mode preferences and removes the temporary smoke keys

A numeric PID difference is reported but is not the proof boundary because Linux can theoretically reuse a PID. The observed no-process interval after `force-stop` is the relevant evidence.

This proves Android process-death preference restoration and fresh core construction. It still does **not** claim CPU/erasable-memory continuation across process death; the intended behavior is a fresh AGC reset with the selected mission and requested AGC mode restored.

## Build-time semantic counterparts

`tools/v35-model-smoke.js` checks the effective clock-side relay model after `app-refine.js` is loaded. In particular it requires `FULLDSP` low-11 `01675` on every ordinary numeric row and `FULLDSP1` low-11 `03675` on the three plus-sign rows, including the unused C bank on relay 8.

`tools/wasm-runtime-smoke.js`, also part of `tools/build-local.sh`, drives the exact pinned yaAGC WASM and both pinned rope images. It explicitly enters P00 with `V37E00E`, executes `V35E`, and requires both physical five-relay banks on selectors 1 through 11 to carry the digit-8 code, plus signs on R1/R2/R3, and the Luminary relay-12 condition-light mask.

These tests prove source/model and real rope/WASM semantics before Gradle packages the APK, but they are still not Android/WebView tests. The live V35 driver is the corresponding end-to-end device gate.

`tools/app-refine-smoke.js` additionally guards clock-V35 key isolation, RSET escape, AGC/mission cleanup ordering, relay-8 FULLDSP behavior, and the immutability of relay diagnostic snapshots.

`tools/build-local.sh` runs `bash -n` over every `tools/*.sh` file and `node --check` over every `tools/*.js` file before functional source smokes or Gradle work. Device-only helpers therefore remain syntax-gated even on a build host with no attached phone.

## Resume/held-PRO guard

`MainActivity.onResume()` deliberately sends a hidden transition immediately before the visible transition. `evaluateJavascript()` issued during `onPause()` is asynchronous, and Android may freeze WebView before that callback executes. The extra idempotent hidden transition guarantees that any stale held PRO input is released before the same in-memory core resumes.

`tools/native-diagnostic-smoke.js` guards this native/frontend contract at source-test time.

## Still manual or separate

A passing full-device smoke does **not** by itself prove:

- pixel-perfect DSKY appearance on the physical display
- real OS screen-off/screen-on behavior rather than the direct lifecycle bridge check
- Activity recreation caused by Android configuration/lifecycle events beyond page reload and explicit process force-stop/relaunch
- Pinball semantics beyond the automated V35E light-test sequence
- PRO standby semantics for a long physical hold
- DreamService selection/startup and non-interactivity
- DREAM DIM / BRIGHT / SOLAR physical brightness behavior
- first-use Android/GrapheneOS location permission behavior for SOLAR
- portrait/landscape DISPLAY cropping on the target phone
- full CM peripheral fidelity; the pinned upstream WASM still lacks an exported `CmOrLm` setter

Those remain explicit acceptance gates. Do not upgrade them to verified status from this smoke alone.

## Verification-status rule

Adding or strengthening a smoke script is not evidence that the behavior passes. The current scripts become verification evidence only after they are run against a current APK built from the corresponding source revision and their output is recorded. Until then they are automated gates awaiting execution.
