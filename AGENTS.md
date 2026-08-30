# Instructions for coding agents

This repository is an Android Apollo DSKY project. Read `docs/PROGRESS.md`, `docs/LOCAL_BUILD.md`, `docs/DEVICE_RUNTIME_SMOKE.md`, and `docs/IMPLEMENTATION_NOTES.md` before changing code.

## Owner requirements

- Keep the repository updated during substantial work. Prefer small, coherent commits.
- Maintain `docs/PROGRESS.md` whenever architecture, blockers, verification gates, or next actions change materially.
- Do **not** add or use GitHub Actions, Codespaces, or other GitHub-hosted build infrastructure unless the owner explicitly reverses this instruction.
- Build, sign, inspect, and test APKs locally/manual when build tooling is available.
- Never commit private signing keys, passwords, tokens, or other credentials.
- Do not claim an APK builds, installs, or runs unless that specific result was actually verified.
- Do not replace the normal Java/Gradle application with hand-written/repacked DEX or diagnostic APK surgery as the final implementation.

## Product intent

The app has two deliberately separate purposes:

1. A synthetic phone clock / charging DreamService presented as an Apollo Block II DSKY.
2. A real AGC emulator mode backed by the pinned VirtualAGC `yaAGC` WebAssembly core.

Do not blur those modes. Phone-clock behavior may emulate DSKY hardware for presentation; AGC mode must be driven by authentic AGC I/O.

The runtime must remain self-contained/offline. The only intended external runtime input is device location for DREAM SOLAR. The merged app must not request `android.permission.INTERNET`.

## Pinned v0.7 runtime

Pinned `vendor/webAGC` revision:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

Required exact inputs:

- `vendor/webAGC/src/yaAGC.wasm`
- `vendor/webAGC/demo/agc/Luminary099.bin`
- `vendor/webAGC/demo/agc/Comanche055.bin`

The build verifies exact size/Git-blob identities before packaging. Do not weaken those checks.

The pinned WASM imports exactly:

- `env.memory`
- `wasi_snapshot_preview1.fd_close`
- `wasi_snapshot_preview1.fd_fdstat_get`
- `wasi_snapshot_preview1.fd_seek`
- `wasi_snapshot_preview1.fd_write`

`agc-core.js` supplies that minimal WASI shim. The verified build path must continue to instantiate the **real pinned WASM with both real ropes under Node** before Gradle; do not replace this with mock-only testing.

## Authenticity rules

- COMP ACTY in AGC mode comes only from output channel `011` octal bit `00002`. Never use network traffic, random pulses, timers, CPU load, or other stand-ins.
- UPLINK ACTY comes from channel `011` bit `00004`.
- yaAGC channel `0163` is emulator-provided DSKY hardware/modulation state; preserve it as distinct from ordinary AGC output channels.
- Normal keys use channel `015` with authentic Pinball codes.
- PRO/Proceed uses channel `032` bit `020000` and must remain press-and-hold capable.
- Preserve the fixed-coordinate SVG EL display and custom segment vectors; do not replace them with a generic seven-segment font.
- Keep EL styling restrained and green/green-white; avoid modern LED effects.
- Verify Apollo/VirtualAGC mappings against primary or established VirtualAGC sources before changing channel/bit/key assignments.

### Channel-010 relay rules

- Preserve the Block II selector/sign/two-5-bit-character matrix.
- Unsupported five-bit character codes are invalid, not alternate blanks.
- Plus/minus sign latches remain independent; rendering gives plus priority if both are asserted, matching VirtualAGC.
- Luminary V35 `FULLDSP`/`FULLDSP1` physically drives both five-relay character banks on every numeric row. Relay 8 renders only its D bank, but its visually unused C bank is still driven to code `035` during V35 and must remain in the physical relay/click model.
- Source-backed low-11 V35 words are `01675` on ordinary numeric rows and `03675` on plus rows 7/5/2.
- V35 relay-12 differs by rope: Luminary099 `00674`, Comanche055 `00650`.

### Real V35 COMP rule

Do **not** assert that real Luminary V35 requires COMP ACTY off. V35's own test mask does not force channel 011 bit 2, but Luminary's Executive normally controls COMP while jobs run/idle and V35 executes as an Executive job.

The live invariant is:

- rendered COMP == raw channel `011` bit `00002`
- rendered UPLINK == raw channel `011` bit `00004`
- TEMP, KEY REL, V/N blanking, OPR ERR, RESTART, STBY and EL-off == the corresponding raw channel `0163` bits

`tools/device-v35-policy-smoke.js` exists specifically to prevent a fixed COMP-off assertion from returning.

Synthetic phone-clock V35 is different: no AGC/Executive exists there, so it does not invent COMP ACTY.

## CM/LM limitation

The pinned WASM engine's upstream `CmOrLm` global defaults to LM (`0`) and its exported WASM API exposes no setter. Desktop yaAGC changes this through configuration code bypassed by the WebAssembly wrapper.

Current policy:

- Luminary099 is the native/default LM path.
- Comanche055 remains an exact pinned selectable CM rope for DSKY execution/testing.
- Do **not** claim full CM peripheral-mode fidelity.
- Known `CmOrLm`-dependent ring-buffer behavior includes LM rotational-hand-controller bookkeeping on channel `013`; this app supplies no RHC inputs.
- Do not binary-patch the pinned WASM to change this flag.
- If exact CM peripheral mode becomes required, rebuild audited yaAGC source with an explicit exported LM/CM API and pin/verify that new binary separately.

## Code organization

- `app/src/main/assets/app.js`: base DSKY UI/mode/lifecycle coordination, DREAM SOLAR astronomy, channel decoding, relay model and synthetic clock behavior.
- `app/src/main/assets/app-refine.js`: narrow post-load source-backed refinements. Current responsibilities include relay-8 FULLDSP physical state, clock-V35 transition/acoustic timing, natural V16 N65 return, mission-change V35 ownership, raw/read-only diagnostics. Do not turn it into a second application implementation; fold mature behavior into `app.js` when a safe full-source edit path is available.
- `app/src/main/assets/agc-core.js`: WASM/rope loading, CPU stepping, packet I/O, input masks, key/PRO injection.
- `app/src/main/assets/runtime-debug.js`: early JavaScript/runtime/CSP diagnostics and debug-build frontend readiness.
- Native shell should remain small: `MainActivity`, `AgcDreamService`, `NetClient`, `DebugReporter` unless a native capability is genuinely required.
- Never reintroduce the removed `TrafficStats` / `agcnet://poll` COMP surrogate or fallback network loading.
- Preserve the strict offline CSP unless a demonstrated runtime incompatibility requires a narrowly justified change. Do not add ordinary `'unsafe-eval'` or `'unsafe-inline'`.

## Important yaAGC startup sequence

The ring-buffer backend initializes lazily. Preserve this order:

1. Load exact 73,728-byte rope into fixed memory.
2. `cpu_reset()`.
3. Disposable `cpu_step(1)` to force ring-buffer/channel initialization and consume stale input.
4. Drain/discard transient output.
5. `cpu_reset()` again for true mission reset state.
6. Queue DSKY U-bit masks for channel `015` and `032`.
7. Begin ordinary execution.

Do not queue input masks before the first engine pass; upstream `ChannelSetup()` would reinitialize and discard them.

## Synthetic V35 timing/model

Source-backed timing distinction:

- normal display service cadence: 120 ms
- relay drive/latch interval: 20 ms
- intervening off phase: 20 ms
- successive dirty-bank service: 40 ms start-to-start

Do not describe the 11 relays in a row as electrically serial; they are commanded in parallel. `playRelayBurst()` only models within-row mechanical/contact scatter.

The synthetic V35 refinement now:

- captures actual pre-test clock relay state;
- computes relay changes into FULLDSP/FULLDSP1;
- spaces synthetic row acoustic bursts 40 ms start-to-start while retaining within-row scatter;
- captures active V35 latches;
- returns through base RSET to canonical V16 N65 after five seconds;
- computes V35-to-clock relay changes on return;
- lets base RSET and base `enterAgc()` own cancellation;
- routes only active-V35 mission changes through base RSET because base `cycleMission()` does not cancel V35 itself;
- clears pending synthetic V35 acoustic timers through the wrapped `cancelLampTest()` ownership point.

Do not claim a historically fixed numeric-row service **order** from the 40 ms cadence alone; the T4 display scanner state is not represented as a fixed synthetic order. Preserve the source-backed cadence without overstating the ordering claim.

## Build gate

Canonical build:

```bash
bash tools/build-local.sh
```

Toolchain contract:

- JDK 17+
- Node.js 18+
- Android SDK platform 37
- Android SDK Build Tools **36.0.0 exactly**
- exact clean pinned `vendor/webAGC`
- stable Gradle 9.5+; system install optional because `tools/gradle-bootstrap.sh` supplies checksum-verified Gradle 9.5.1 locally when absent

The Gradle bootstrap must remain local-only and verify the official distribution SHA-256.

The canonical build path must continue to run:

- `bash -n` for every `tools/*.sh`
- `node --check` for every `tools/*.js`
- manifest/network policy smoke
- strict CSP smoke
- frontend/source smoke
- app-refinement behavioral smoke
- device-V35 raw-channel policy smoke
- display/crop geometry smoke
- DREAM SOLAR/polar-regime smoke
- AGC-wrapper smoke
- runtime-debug/readiness smoke
- native diagnostic smoke
- DSKY mapping smoke
- effective V35 model smoke (`app.js` + complete `app-refine.js` VM load)
- asset-reference smoke
- real pinned yaAGC + both-rope runtime smoke, including `V37E00E` P00 proof and V35 FULLDSP/FULLDSP1/relay-12 semantics
- clean Gradle build
- post-build APK verification

`tools/verify-apk.sh` must continue checking package/version/SDK metadata, debuggable test status, location permissions, absence of INTERNET, exact pinned binary blobs, byte-for-byte current frontend assets discovered from `index.html`, absence of unused vendor trees, and APK signature validity.

## Device verification discipline

`tools/device-smoke.sh` is the immediate ADB install/launch gate. It preserves app data, clears only stale private debug evidence, captures APK/source provenance, launches the Activity, and requires `FRONTEND READY app`. Readiness now requires `snapshotRelays`, `snapshotChannels`, and `snapshotDsky` as well as rendered frontend state.

`tools/device-agc-smoke.sh` uses the app process's real WebView DevTools socket and dependency-free CDP drivers against the actual packaged WebView. Do not replace the real `AgcCore` with mocks.

The same-process live gate currently:

- enters Luminary099 and Comanche055 with real yaAGC output/version evidence
- exercises VERB pointer input and held PRO
- verifies same-WebView pause/resume preserves the core object
- enters Luminary P00 using pointer-driven `V37E00E` and requires actual channel-010 PROG `00` / low-11 `01265`
- executes `V35E` and requires exact Luminary channel-010 V35 relay latches, rendered `88` / `+88888`, source-backed annunciators, and real yaAGC V/N + KEY REL/OPR ERR modulation
- validates channel-011/channel-0163-rendered discretes against the raw captured channel words rather than assuming COMP state
- reloads the packaged page in CM AGC mode and requires persisted mission/run-mode restoration on a newly constructed core

`AGCDSKY.snapshotRelays()`, `snapshotChannels()`, and `snapshotDsky()` are read-only diagnostics for those gates; returned state must remain copied, not mutable production objects.

`tools/device-process-recreation-smoke.sh` separately force-stops the Android process, requires an observed no-process interval, relaunches, reconnects to the new WebView, and verifies persisted CM/AGC preference restoration on a fresh core. It must best-effort restore the pre-smoke preferences.

Preferred current debug checkpoint:

```bash
bash tools/device-full-smoke.sh app/build/outputs/apk/debug/app-debug.apk
```

## Verification discipline

Record actual evidence in `docs/PROGRESS.md`.

Good examples:

- `Pinned WASM import table inspected; exact imports are env.memory + four WASI fd functions.`
- `Real pinned WASM instantiated under Node with both ropes; semantic V35 gate passed.`
- `Built APK passed verify-apk.sh and device-full-smoke.sh on GrapheneOS.`

Bad examples:

- `Core integrated` when only files were copied.
- `Build passes` when only syntax/source checks ran.
- `Device gate verified` when only a smoke script was committed.

If blocked, document the blocker and shortest next experiment. Do not hide it with mock behavior.

## Repository hygiene

- GPL-2.0 compatibility and upstream attribution matter. Update `THIRD_PARTY.md` when vendoring code/binaries.
- Keep large/generated binaries intentional and documented.
- Never commit private signing material.
- Do not commit APKs as proof unless produced from the corresponding source revision and signing provenance is clear.
- Keep README/docs synchronized with reality; remove stale claims rather than preserving aspirational wording.
