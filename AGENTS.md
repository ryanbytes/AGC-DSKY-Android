# Instructions for coding agents

This repository is an Android Apollo DSKY project. Read `docs/PROGRESS.md`, `docs/LOCAL_BUILD.md`, and `docs/IMPLEMENTATION_NOTES.md` before changing code.

## Owner requirements

- Keep the repository updated during substantial work. Prefer small, coherent commits over one giant end-of-session dump.
- Maintain `docs/PROGRESS.md` whenever architecture, blockers, completed checkpoints, or the next action changes materially.
- Do **not** add or use GitHub Actions, Codespaces, or other GitHub-hosted build infrastructure unless the owner explicitly reverses this instruction.
- Build, sign, inspect, and test APKs locally/manual when build tooling is available.
- Never commit private signing keys, passwords, tokens, or other credentials.
- Do not claim an APK builds, installs, or runs unless that specific result was actually verified.
- Do not replace the normal Java/Gradle application with hand-written/repacked DEX or diagnostic APK surgery as the final implementation.

## Product intent

The app has two distinct purposes:

1. A phone clock / charging DreamService presented as an Apollo Block II DSKY.
2. A real AGC emulator mode backed by an onboard Apollo Guidance Computer execution core.

Do not blur these modes. Phone clock state is synthetic. AGC mode must be driven by authentic AGC I/O.

The runtime must remain self-contained/offline. The only intended external runtime input is device location for DREAM SOLAR sunrise/sunset behavior. The merged app must not request `android.permission.INTERNET`.

## Current v0.7 core state

The intended core is the pinned VirtualAGC `yaAGC` WebAssembly binary supplied by the `vendor/webAGC` submodule at:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

Required exact binary inputs:

- `vendor/webAGC/src/yaAGC.wasm`
- `vendor/webAGC/demo/agc/Luminary099.bin`
- `vendor/webAGC/demo/agc/Comanche055.bin`

The build already verifies exact byte sizes and Git-blob SHA-1 values before packaging. Do not weaken or bypass those checks.

The pinned WASM import table has been inspected directly. It imports exactly:

- `env.memory`
- `wasi_snapshot_preview1.fd_close`
- `wasi_snapshot_preview1.fd_fdstat_get`
- `wasi_snapshot_preview1.fd_seek`
- `wasi_snapshot_preview1.fd_write`

`app/src/main/assets/agc-core.js` supplies that minimal WASI shim. The verified build path also instantiates the **real pinned WASM under Node** with both real ropes before Gradle starts. Do not replace this with a mock-only check.

## Authenticity rules

- COMP ACTY in AGC mode must come from Block II output channel `011` octal, bit 2 (`0b10`).
- Do not use network traffic, random pulses, animation timers, CPU load, or other stand-ins for COMP ACTY in AGC mode.
- Preserve the fixed SVG EL display coordinate system. Do not replace the custom segment vectors with a generic seven-segment font.
- Keep EL styling restrained and green/green-white; avoid modern LED bloom effects.
- Verify Apollo/VirtualAGC mappings against primary or established VirtualAGC/webAGC sources before changing channel/bit/key assignments.
- Normal DSKY keys use channel `015` octal with authentic Pinball key codes.
- PRO/Proceed uses channel `032` octal, bit `020000`, and must remain press-and-hold capable rather than being reduced to a fixed synthetic pulse.
- webAGC/yaAGC channel `0163` is emulator-provided modulation for DSKY hardware/blink states; preserve the distinction between this and ordinary AGC output channels.
- Channel `010` relay decoding must preserve the Block II selector/sign/5-bit character matrix. Unsupported five-bit character codes are invalid, not alternate blank codes.
- Luminary V35 `FULLDSP`/`FULLDSP1` physically drives both five-relay character banks on every numeric relay row. Relay selector 8 renders only its D bank, but V35 still drives its visually unused C bank to code `035`; do not optimize that physical state away.

## CM/LM limitation

The pinned WASM engine's upstream `CmOrLm` global defaults to LM (`0`) and its exported WASM API does not expose a setter. Desktop yaAGC normally changes this through CLI/configuration code that the WebAssembly wrapper bypasses.

Current policy:

- Luminary099 is the native/default LM path.
- Comanche055 is an exact pinned CM rope and remains a supported selectable mission for DSKY execution/testing.
- Do **not** claim full CM peripheral-mode fidelity.
- In the ring-buffer path used by webAGC, the known `CmOrLm`-dependent behavior is LM rotational-hand-controller bookkeeping on channel `013`; this app currently supplies no RHC inputs.
- Do not binary-patch the pinned WASM to change this flag.
- If exact CM peripheral mode becomes required, rebuild yaAGC from audited VirtualAGC source with an explicit exported LM/CM configuration API, then pin and verify that new binary separately.

## Code organization

Keep emulator integration separate from UI state:

- `app/src/main/assets/app.js`: DSKY UI/mode/lifecycle coordination, DREAM SOLAR astronomy, authentic channel decoding, and the base relay model.
- `app/src/main/assets/app-refine.js`: small post-load source-backed refinements that must remain narrow: current clock-V35 isolation, relay-8 FULLDSP physical-state correction, and read-only relay/render diagnostics used by device smokes. Do not turn this into a second application implementation; move mature logic into `app.js` when a safe full-source edit is available.
- `app/src/main/assets/agc-core.js`: WASM loading, rope loading, CPU stepping, packet I/O, input masks, key/PRO injection.
- `app/src/main/assets/runtime-debug.js`: early JavaScript/runtime/CSP diagnostics and debug-build frontend readiness marker.
- Android shell code should stay small: `MainActivity`, `AgcDreamService`, `NetClient`, and `DebugReporter` unless a native capability is genuinely required.
- Do not reintroduce the removed `TrafficStats` / `agcnet://poll` COMP ACTY surrogate or fallback network loading.
- Preserve the strict offline frontend Content Security Policy unless a concrete runtime incompatibility is demonstrated. Do not solve CSP problems by adding ordinary `'unsafe-eval'` or `'unsafe-inline'`.

## Important runtime sequencing

The ring-buffer backend initializes lazily. The correct reset/load sequence is already implemented and must be preserved:

1. Load the exact 73,728-byte rope into fixed memory.
2. `cpu_reset()`.
3. Perform one disposable `cpu_step(1)` solely to force lazy ring-buffer/channel-mask initialization and consume stale peripheral input.
4. Drain/discard transient output from that disposable step.
5. `cpu_reset()` again so mission execution begins at the true reset state.
6. Queue DSKY U-bit masks for channel `015` and channel `032`.
7. Start ordinary mission stepping.

Do not queue input masks before the first engine pass; upstream `ChannelSetup()` would reinitialize the ring buffer/masks and discard them.

## Build gate

The canonical build entrypoint is:

```bash
bash tools/build-local.sh
```

The current local toolchain contract is documented in `docs/LOCAL_BUILD.md` and includes:

- JDK 17+
- Node.js 18+
- Android SDK platform 37
- Android SDK Build Tools **36.0.0 exactly**
- exact clean pinned `vendor/webAGC` checkout
- stable Gradle 9.5+; a system installation is optional because `tools/gradle-bootstrap.sh` supplies checksum-verified Gradle 9.5.1 locally when `gradle` is absent

The Gradle bootstrap must remain local-only and verify the published Gradle distribution SHA-256 before execution. Do not turn it into hosted build infrastructure, and do not weaken the checksum check merely to make a download succeed.

The canonical build path must continue to run:

- shell syntax checks for every `tools/*.sh`
- `node --check` for every `tools/*.js`
- manifest/network policy smoke
- strict frontend CSP smoke
- frontend/source smoke
- app-refinement smoke, including V35 transition isolation, relay-8 FULLDSP behavior, and read-only relay diagnostics
- display/crop geometry smoke
- DREAM SOLAR astronomy/polar-regime smoke
- AGC wrapper smoke
- runtime-debug/CSP diagnostic smoke
- native diagnostic smoke
- DSKY mapping smoke
- effective V35 relay-model smoke (`app.js` + `app-refine.js`)
- asset-reference smoke
- real pinned yaAGC WASM + both-rope runtime smoke, including semantic `V37E00E` -> `V35E` proof of FULLDSP/FULLDSP1 relay states
- clean Gradle build
- post-build APK verification

`tools/verify-apk.sh` must continue verifying package/version/SDK metadata, debuggable status for the test APK, required location permissions, absence of INTERNET, exact pinned binary blobs, byte-for-byte frontend assets, absence of unused vendor trees, and APK signature validity.

## Device verification discipline

`tools/device-smoke.sh` is the immediate ADB install/launch gate for the debug APK. It must preserve app data, clear only the stale private debug report, capture APK/source provenance, launch the Activity, collect evidence, and require the debug-only `FRONTEND READY app` marker. A process that merely stays alive while the WebView is blank or partially initialized is not a pass.

`tools/device-agc-smoke.sh` is the live WebView/AGC runtime gate. It waits for the app process's real `webview_devtools_remote_*` socket, forwards that socket with `adb`, and runs dependency-free Chrome DevTools Protocol drivers against the actual packaged WebView. They must continue using the real `AgcCore`; do not replace them with mocks.

The same-process live gate currently:

- enters both Luminary099 and Comanche055 and requires a running yaAGC core/version plus real DSKY output channels
- exercises VERB through the actual DSKY pointer path
- exercises held PRO pointer-down/release
- verifies same-WebView pause/resume preserves the same core object
- drives Luminary `V37E00E` then `V35E` through pointer handlers
- requires exact Luminary V35 channel-010 low-11 relay latches: `01675` on ordinary numeric rows, `03675` on the R1/R2/R3 plus rows, relay 8 also `01675` including its unused C bank, and relay 12 `00674`
- requires rendered PROG/VERB/NOUN `88` and R1/R2/R3 `+88888`
- requires the steady V35 annunciators, COMP ACTY off, and an observed yaAGC-modulated V/N + KEY REL/OPR ERR off phase
- reloads the packaged page in CM AGC mode and requires persisted mission/run-mode restoration on a newly constructed core object

`window.AGCDSKY.snapshotRelays()` and `snapshotDsky()` exist specifically to make those device checks diagnostic: they return copies of relay/render/lamp state and must not expose mutable production relay objects.

`tools/device-process-recreation-smoke.sh` separately performs `adb shell am force-stop`, requires an observed no-process interval, relaunches the app, reconnects to the new WebView socket, and requires persisted CM/AGC state to create a fresh running core. It must best-effort restore the user's pre-smoke frontend preferences on both success and failure.

`tools/device-full-smoke.sh <apk>` chains the immediate install/launch gate, live AGC/page-recreation gates, and the Android process-recreation gate. Use it as the preferred automated device checkpoint for a current debug APK.

A successful full device smoke still does not prove every user-visible behavior. Manual/device gates still include:

- pixel-perfect DSKY appearance on the physical screen
- representative Pinball semantics beyond the automated V35 light test
- a long physical PRO hold for standby behavior
- real OS screen off/on behavior in addition to the direct lifecycle bridge smoke
- Android lifecycle/configuration Activity recreation beyond the automated page reload and explicit process force-stop/relaunch
- DreamService selection/startup/display-only behavior through normal Android UI
- DREAM DIM / BRIGHT / SOLAR physical brightness and location-permission behavior on the target OS
- portrait/landscape DISPLAY cropping/scaling on the physical target

## Verification discipline

For every significant checkpoint, record what was actually tested in `docs/PROGRESS.md`.

Examples:

- Good: `Pinned WASM import table inspected; exact imports are env.memory + four WASI fd functions.`
- Good: `Real pinned WASM instantiated under Node with Luminary099 and Comanche055; both ran CPU/DSKY input smoke.`
- Good: `Built APK passed tools/verify-apk.sh and device-full-smoke.sh on GrapheneOS.`
- Bad: `Core integrated` when only files were copied.
- Bad: `Build passes` when only syntax/source checks were run.
- Bad: `Device recreation verified` when only a new smoke script was committed but not executed on a corresponding APK.

If a blocker appears, document the blocker and the shortest next experiment. Do not hide it by substituting a mock behavior.

## Repository hygiene

- GPL-2.0 compatibility and upstream attribution matter. Update `THIRD_PARTY.md` when vendoring code/binaries.
- Keep large/generated binaries intentional and documented.
- Do not commit APKs as proof of a build unless the APK was actually produced from the corresponding source revision and its signing provenance is clear.
- Keep README claims synchronized with reality; remove stale statements rather than preserving aspirational wording.
