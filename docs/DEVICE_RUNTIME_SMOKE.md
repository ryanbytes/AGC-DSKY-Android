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
bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk
```

This runs the immediate install/launch/frontend smoke, live AGC/WebView checks, page-recreation check, and finally an Android process force-stop/relaunch check.

The aggregate gate derives the package ID from the APK and accepts only `org.apollo.agcdsky.eltest`, keeping these destructive-to-process test actions isolated from the production app. It passes that same package ID to each live stage; the standalone AGC and process-recreation drivers also default to and enforce `.eltest`.

### Immediate device smoke

`tools/device-smoke.sh`:

- accepts only the isolated `org.apollo.agcdsky.eltest` debug package, rejecting production before install
- calculates the APK SHA-256 and records the source commit
- installs/updates the APK without intentionally clearing app data
- launches the interactive Activity
- captures logcat and the app-private debug report
- requires the debug-only `FRONTEND READY app` marker
- rejects obvious fatal Android/WebView events

A process that merely stays alive with a blank or partially initialized WebView is not a pass. The marker is emitted by the final script in `index.html` only after all packaged frontend scripts have evaluated and `AGCDSKY.appStatus` is available. The immediate smoke also rejects a saved app-local debug report and obvious fatal Android/WebView events. This startup marker does not exercise the AGC runtime or prove the diagnostic snapshot methods; those are checked by the separate live AGC drivers.

### Live AGC runtime smoke

`tools/device-agc-smoke.sh` waits for the actual `webview_devtools_remote_*` socket belonging to the app process, forwards it with `adb`, and runs three dependency-free Chrome DevTools Protocol drivers against that same packaged WebView:

1. `tools/device-agc-smoke.js` checks CM core startup, basic pointer input, held PRO behavior, and same-WebView pause/resume identity.
2. `tools/device-v35-smoke.js` performs the source-backed semantic Pinball light-test gate described below.
3. `tools/device-recreation-smoke.js` enters CM AGC mode, tags the live core object, reloads the actual packaged page with DevTools `Page.reload`, and requires CM AGC mode to re-enter on a newly constructed core object.

None of these drivers injects a mock `AgcCore`.

The general live gate checks:

- the interactive packaged frontend is initialized
- Apollo 11 CM `Comanche055.bin` can enter AGC mode
- the real yaAGC core is present, running, and reports a version
- live WASM `get_cm_mode()` returns `1`, proving CM peripheral mode in the packaged WebView
- real DSKY output channels are observed from the running core
- VERB input is delivered through the actual DSKY pointer handler without stopping the core
- PRO is asserted on pointer-down, remains visibly held, and releases on pointer-up
- a hidden/visible `visibilitychange` transition releases held PRO, pauses and resumes the same in-memory AGC instance without replacing it
- the CM run produces real DSKY output without an AGC error
- page recreation restores requested CM AGC mode and the full WASM linear-memory snapshot into a new CM core
- the new core reports CM peripheral mode after page recreation and Android process recreation
- the pre-reload core tag does not survive page recreation, proving a new JavaScript/yaAGC core object is constructed; a separate `lastAction=restored` assertion proves saved WASM memory is imported into it

The smoke records and restores the persistent run-mode setting. The page-recreation gate also saves a live 327,680-byte WASM memory checkpoint before reload and requires the new core to report `lastAction=restored` afterward. Snapshot restore checks the saved mission and yaAGC version, then validates the full linear-memory length and fingerprint. JavaScript scheduler counters restart and external DSKY inputs are released; this gate proves AGC memory restoration, not uninterrupted wall-clock execution or physical DSKY fidelity.

## Relay- and channel-aware V35 semantic gate

`tools/device-v35-smoke.js` enters CM P00 through the pointer sequence `V37E00E`, waits until channel-010 selector 11 actually carries PROG `00` low-11 `01265`, executes `V16N65E` through the same on-screen pointer handlers, and requires its exact Pinball code sequence plus numeric register output with raw channel-0163 and rendered OPR ERR both clear. It returns to P00, enters and executes source-backed `V05N09E` through pointer input, captures raw FAILREG through the core's read-only `readErasable` method, and requires the displayed register digits and actual rendered EL slots to match those three values without changing FAILREG. It then returns to P00 and enters/executes `V14N09E` through DevTools `Input.dispatchKeyEvent`. That last case exercises the WebView's hardware-key `keydown`/`keyup` listener and requires two octal result words with OPR ERR clear. It then enters `V35E`. The host real-WASM gate independently decodes all 15 octal digit positions from the channel-010 relay words and compares them to raw FAILREG; it also requires all eight numeric selectors and exactly the six R1/R2 selectors for V14N09. DevTools keyboard events are emulator input evidence; they do not replace testing a physical keyboard on a handset.

To save a visual artifact from the verified real test, set `AGC_V35_SCREENSHOT_PATH` to a new local filename before running the device smoke. The driver verifies the AGC display model and the values written to the actual SVG digit slots, waits two animation frames, rechecks the full V35 and relay/channel state, then captures the WebView with DevTools `Page.captureScreenshot`. It refuses to overwrite an existing file. This is an inspection aid and does not replace the semantic assertions.

The frontend exposes read-only diagnostics:

- `AGCDSKY.snapshotRelays()` — clock and AGC channel-010 latch copies
- `AGCDSKY.snapshotChannels()` — most recent raw channel `011` and `0163` words plus their source mode
- `AGCDSKY.snapshotDsky()` — combined relay/channel/render/lamp snapshot

The copies are diagnostic only and do not expose mutable production state. This lets the driver distinguish an AGC-output error, a channel-to-lamp decoder error, and an SVG rendering error.

A V35 pass requires all of the following at the same visible/on phase:

- PROG `88`
- VERB `88`
- NOUN `88`
- R1 `+88888`
- R2 `+88888`
- R3 `+88888`
- channel-010 selectors 1 through 11 contain the source-backed `FULLDSP`/`FULLDSP1` low-11 relay words
- selector 8 is specifically `01675`, including the visually unused C five-relay bank driven during V35
- relay 12 is `00650` for the CM condition lights
- UPLINK, TEMP, NO ATT, GIMBAL LOCK, STBY, PROG, RESTART, and TRACKER are on
- KEY REL and OPR ERR are on during the visible phase
- EL power-off is not asserted
- the frontend synthetic clock-test flag is false, proving this state came from the real AGC path rather than the phone-clock V35 convenience path
- the rendered channel-011 and channel-0163 discretes exactly match the raw words captured from yaAGC

### COMP ACTY is channel-derived, not hard-coded

The real V35 gate deliberately does **not** require COMP ACTY to be off. Its assertion is checked against contemporaneous channel `011` bit `00002`.

The invariant is stricter and simpler:

- rendered COMP ACTY == raw channel `011` bit `00002`
- rendered UPLINK ACTY == raw channel `011` bit `00004`

`tools/device-v35-policy-smoke.js` is part of the host build and explicitly rejects reintroducing a fixed `state.lamps.comp === false` assertion.

### Raw channel 0163 fidelity

For each sampled real-AGC V35 state, the live gate requires:

- TEMP == channel `0163` bit `00010`
- KEY REL == `00020`
- V/N blanking == `00040`
- OPR ERR == `00100`
- RESTART == `00200`
- STBY == `00400`
- EL-off == `01000`

The driver then waits for yaAGC's hardware-model modulation and requires an observed off phase where V/N blanking is asserted and KEY REL / OPR ERR are off while the steady V35 annunciators and channel-010 relay latches remain present. That off-phase snapshot must also match the contemporaneous raw channel-0163 word.

That proves the path:

`pointer input -> Pinball/Comanche055 -> yaAGC raw channels/relay words -> frontend decoders -> annunciators/SVG`

It is intentionally stronger than decoding the SVG and seeing a collection of 8s.

### Why relay 8 is `01675`

Comanche `VBTSTLTS` writes `FULLDSP = 05675` into every numeric `DSPTAB` entry. T4 strips the upper dirty/selector portion before channel-010 output, leaving low-11 `01675`: C=`035`, D=`035`.

Relay selector 8 connects only D to visible R1D1, so ordinary display decoding ignores its C field. V35 still energizes that unused five-relay bank. Both the synthetic relay model and the real-WASM/device semantic gates retain this physical distinction.

### Android process recreation smoke

`tools/device-process-recreation-smoke.sh` is intentionally separate from the same-WebView CDP run because `adb shell am force-stop` destroys the app process and its DevTools socket.

The process gate:

1. launches the current app and finds its real process/WebView socket
2. stores the user's original mission/run-mode preferences in temporary localStorage smoke keys
3. selects `Comanche055` and enters AGC mode
4. waits two seconds for Android WebView's asynchronous localStorage commit
5. records the original PID
6. performs `adb shell am force-stop "$PACKAGE"` on the isolated `.eltest` package
7. requires `pidof` to become empty, proving the process actually disappeared rather than inferring death from a PID change
8. relaunches the Activity and discovers the new process/WebView socket
9. reconnects through CDP
10. requires the persisted smoke nonce, CM mission, requested AGC mode, a running yaAGC version, a restored full linear-memory snapshot, and real DSKY output channels
11. restores the user's original frontend mission/run-mode preferences and removes the temporary smoke keys

The two-second delay is needed because Android WebView writes localStorage to its origin store asynchronously; without it, an immediate force-stop can race the storage commit. A numeric PID difference is reported but is not the proof boundary because Linux can theoretically reuse a PID. The observed no-process interval after `force-stop` is the relevant evidence.

This proves Android process-death run-mode restoration, fresh core construction, and restoration of the saved full WASM linear memory. It does not claim uninterrupted execution during process death: JavaScript scheduler counters restart and external DSKY inputs are released.

## Build-time semantic counterparts

`tools/v35-model-smoke.js` checks the effective clock-side relay model against the current modular runtime. In particular it requires `FULLDSP` low-11 `01675` on every ordinary numeric row and `FULLDSP1` low-11 `03675` on the three plus-sign rows, including the unused C bank on relay 8. Its COMP exclusion applies only to the synthetic phone-clock convenience test.

The modular runtime smokes in `tools/source-smoke-tests.txt` guard clock-to-V35-to-clock physical relay deltas, natural five-second return to canonical V16 N65, V35 key isolation, RSET/mission/AGC transition behavior, and immutable relay/raw-channel diagnostics.

`tools/device-v35-policy-smoke.js` statically guards the live-device proof contract: raw channel `011` and `0163` must drive the discrete assertions, and a fixed COMP-off assertion is forbidden.

`tools/wasm-runtime-smoke.js`, also part of `tools/build-local.sh`, drives the exact pinned yaAGC WASM and Comanche rope. It enters P00 with `V37E00E`, proves the channel-010 PROG `00` relay state, executes `V35E`, and requires both physical five-relay banks on selectors 1 through 11 to carry the digit-8 code, plus signs on R1/R2/R3, and CM relay-12 low-11 state `00650`.

These tests prove source/model and real Comanche-rope/WASM semantics before Gradle packages the APK, but they are still not Android/WebView tests. The live V35 driver is the corresponding end-to-end device gate.

`tools/build-local.sh` runs `bash -n` over every `tools/*.sh` file and `node --check` over every `tools/*.js` file before functional source smokes or Gradle work. Device-only helpers therefore remain syntax-gated even on a build host with no attached phone.

## Resume/held-PRO guard

`MainActivity.onResume()` deliberately sends a hidden transition immediately before the visible transition. `evaluateJavascript()` issued during `onPause()` is asynchronous, and Android may freeze WebView before that callback executes. The extra idempotent hidden transition guarantees that any stale held PRO input is released before the same in-memory core resumes.

`tools/native-diagnostic-smoke.js` guards this native/frontend contract at source-test time.

## Still manual or separate

A passing full-device smoke does **not** by itself prove:

- pixel-perfect DSKY appearance on the physical display
- Fire OS and physical-handset screen-off/screen-on behavior. The Android 16 emulator now has a separate real system sleep/wake check: during `Asleep`, packaged WebView state reports `appVisible=false`, `coreRunning=false`, and the same core identity; after wake, the same Activity resumes the same core. The emulator AC stay-awake setting and app `FLAG_KEEP_SCREEN_ON` remained enabled.
- Activity recreation caused by Android configuration/lifecycle events beyond page reload and explicit process force-stop/relaunch
- live packaged-WebView Pinball semantics beyond V16N65E, V05N09E, V14N09E, and the automated V35E light-test sequence. The host real-WASM gate additionally covers Comanche P00 and MARK/KEYRUPT2 through actual channel-015/channel-016 input. Physical keyboard behavior on a handset remains unverified.
- PRO standby semantics for a long physical hold
- DreamService selection/startup, actual Android touch delivery, lifecycle, and DIM/BRIGHT/SOLAR behavior. Source intends interactive mode: a brief tap toggles relay ticking and a 1.8-second hold exits through `DreamBridge`; `tools/dream-interaction-smoke.js` checks the source gesture path, but this emulator has no DreamManager service.
- DREAM DIM / BRIGHT / SOLAR physical brightness behavior
- first-use Android/GrapheneOS location permission behavior for SOLAR
- portrait/landscape DISPLAY cropping on the target phone
- Fire-specific CM configuration and runtime behavior remain unverified; the current Regular debug Android/WebView gate reads back `get_cm_mode() == 1`.

Those remain explicit acceptance gates. Do not upgrade them to verified status from this smoke alone.

## Verification-status rule

Adding or strengthening a smoke script is not evidence that the behavior passes. The current scripts become verification evidence only after they are run against a current APK built from the corresponding source revision and their output is recorded. Until then they are automated gates awaiting execution.
