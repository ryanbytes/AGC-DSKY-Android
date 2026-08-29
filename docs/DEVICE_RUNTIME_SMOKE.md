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
2. `tools/device-v35-smoke.js` performs a semantic Pinball test: it selects Luminary099, drives `V37E00E` and then `V35E` through the actual on-screen DSKY pointer handlers, decodes the rendered SVG segment state, and requires PROG/VERB/NOUN `88` plus `88888` in R1/R2/R3.
3. `tools/device-recreation-smoke.js` selects Comanche055 in AGC mode, tags the live core object, reloads the actual packaged page with DevTools `Page.reload`, and requires the persisted CM mission + requested AGC mode to re-enter on a newly constructed core object.

None of these drivers injects a mock `AgcCore`.

The live gate checks:

- the interactive packaged frontend is initialized
- Apollo 11 LM `Luminary099.bin` can enter AGC mode
- the real yaAGC core is present, running, and reports a version
- real DSKY output channels are observed from the running core
- VERB input is delivered through the actual DSKY pointer handler without stopping the core
- PRO is asserted on pointer-down, remains visibly held, and releases on pointer-up
- an in-memory AGC instance pauses and resumes through `AGCDSKY.setAppVisible(false/true)` without being replaced
- Apollo 11 CM `Comanche055.bin` can enter AGC mode in a separate mission run
- the CM run also produces real DSKY output without an AGC error
- Luminary accepts the authentic `V37E00E` P00 sequence through the pointer path before the semantic test
- Luminary accepts `V35E` through the pointer path and the real AGC output path renders the complete all-8 numerical DSKY light-test pattern
- page recreation restores the persisted `Comanche055` mission selection
- page recreation restores requested AGC mode and starts the selected mission again
- the pre-reload core tag does not survive page recreation, proving a new JavaScript/yaAGC core object is constructed rather than presenting the old in-memory core as serialized state

The smoke snapshots the persistent mission/run-mode settings and attempts to restore them afterward. If the pre-test state was an active AGC run, restoration necessarily starts that mission from a fresh AGC reset; exact CPU/erasable-memory state is not serialized by the app.

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

## Build-time semantic counterpart

`tools/wasm-runtime-smoke.js`, already part of `tools/build-local.sh`, performs the same class of V35 semantic check directly against the exact pinned yaAGC WASM and both pinned rope images under Node. It explicitly enters P00 with `V37E00E`, executes `V35E`, and requires the complete channel-010 all-8 numerical relay pattern.

That test proves real rope/software semantics before Gradle packages the APK, but it is still not an Android/WebView test. The live V35 driver above is the corresponding end-to-end device gate.

`tools/build-local.sh` also runs `bash -n` over every `tools/*.sh` file and `node --check` over every `tools/*.js` file before the functional source smokes or Gradle build. Device-only helpers therefore remain syntax-gated even on a build host with no attached phone.

## Resume/held-PRO guard

`MainActivity.onResume()` deliberately sends a hidden transition immediately before the visible transition. `evaluateJavascript()` issued during `onPause()` is asynchronous, and Android may freeze WebView before that callback executes. The extra idempotent hidden transition guarantees that any stale held PRO input is released before the same in-memory core resumes.

`tools/native-diagnostic-smoke.js` guards this native/frontend contract at source-test time.

## Still manual or separate

A passing full-device smoke does **not** by itself prove:

- pixel-perfect DSKY relay/sign/annunciator appearance on the physical screen
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

Adding a smoke script is not evidence that the behavior passes. The current scripts become verification evidence only after they are run against a current APK built from the corresponding source revision and their output is recorded. Until then they are automated gates awaiting execution.
