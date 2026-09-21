# AGC DSKY Android progress

Last updated: 2026-09-20

## Current repository status — 2026-09-20

This section supersedes older phase-local statements below that say a build or hosted verification path was unavailable. Those statements remain useful as historical records of what had and had not been proved at the time of each phase; they are not the current repository-wide status.

Current `main` before the fidelity/status pass is `671bd5ec0315233477712e4b612788b49622259f`.

Verified on that exact main revision:

- Android GitHub Actions run `35543346568` completed successfully;
- the canonical source-smoke suite passed;
- regular release, regular debug/EL-test, Fire debug/release, and unique install-fix APK assembly passed;
- installable regular and Fire APK signing passed;
- side-by-side signature/package/icon/restored-asset verification passed;
- PWA GitHub Actions run `35543346539` completed successfully.

The open-ended runtime cleanup is complete at **Phase 83**. `docs/RUNTIME_REFACTOR.md` is the authoritative cutoff record. Do not restart numbered architecture-cleanup phases without a concrete failure and a regression test.

Physical-device acceptance remains a separate claim from source/build CI. A successful hosted build does not by itself prove Pixel/Fire runtime behavior.

The current fidelity pass replaces the remaining replica-derived numeric EL/sign outlines with the drawing-backed `1006315G` geometry while leaving unrelated placement values alone unless the source resolves them.


## 2026-09-18 SNTP / network-time repair

The reported clock-sync failure traced to a real platform split rather than the SNTP client itself:

- `SensorMainActivity` and `AgcDreamService` already started `NtpTime` and exposed `TimeBridge`;
- the regular/Fire `MainActivity` did neither, so its frontend could only retain the default zero offset and Android wall clock;
- PWA/web cannot use UDP SNTP from browser JavaScript, so it also had no external network-time correction path.

This repair:

- starts `NtpTime` and registers/removes the listener in `MainActivity`;
- exposes `TimeBridge.getStatus()` in `MainActivity` and pushes native SNTP status updates into the shared frontend;
- tears the bridge down with the WebView;
- preserves Cloudflare UDP SNTP as the authoritative Android correction source;
- adds a browser-only same-origin HTTP `Date` fallback using three no-cache HEAD samples, midpoint/RTT correction, a median offset, ten-minute resync throttling, and the same two-hour stale policy;
- labels browser fallback as NETWORK TIME rather than claiming browser UDP SNTP;
- expands `tools/ntp-policy-smoke.js` so MainActivity, SensorMainActivity, DreamService, and the browser fallback are all source-gated.

No system clock is set and `android.permission.SET_TIME` remains forbidden. WebView network loading remains blocked; Android SNTP stays native.

Verification status for this repair:

- [x] source changes committed on `fix/sntp-mainactivity-web-fallback`;
- [x] policy test source updated to catch the exact missing-MainActivity regression;
- [ ] canonical `bash tools/build-local.sh` has been run for this branch;
- [ ] regular/Fire APKs from this branch have been installed and clock-sync behavior verified on-device;
- [ ] deployed PWA HTTP-Date fallback has been checked in Brave/Chromium.

Do not upgrade the unchecked items without observed build/device/browser evidence.

## 2026-09-14 DSKY runtime refactor phase 30

`startup-defaults.js` had become a catch-all for four unrelated boot concerns: persistent run-mode defaulting, page-owned browser-resource teardown, chunked AGC snapshot transport, and camera console-error classification.

Phase 30 narrows that startup ownership without changing AGC/DSKY semantics:

- `startup-defaults.js` now owns only the first-run CLOCK persistence default;
- `page-resource-lifecycle.js` owns timer/interval/animation-frame tracking, WebAudio wrapper cleanup, media/core teardown, and `AGCLifecycle`;
- `agc-snapshot-codec.js` owns only the existing chunked `AgcCore` snapshot encoding/decoding path and preserves snapshot schema 1;
- `camera-error-policy.js` owns only SXT camera console classification, downgrading expected permission/lifecycle outcomes while preserving unexpected failures as errors;
- parser order is locked as `agc-core.js -> spacecraft-default.js -> startup-defaults.js -> page-resource-lifecycle.js -> agc-snapshot-codec.js -> camera-error-policy.js -> app-state-runtime.js`, so `AgcCore` exists before the codec patch, page-resource wrappers still install before application timers/audio work, and camera classification installs before `optics.js` can report camera failures;
- `tools/startup-runtime-smoke.js` source-gates those ownership boundaries and behaviorally checks first-run mode defaulting, tracked resource cleanup, AudioContext closed-state removal, snapshot round-trip behavior, and camera-error classification;
- `tools/audio-recovery-smoke.js` now reads `page-resource-lifecycle.js` directly for the closed-AudioContext lifecycle invariant instead of coupling that test to the old catch-all file;
- `tools/asset-reference-smoke.js` requires the new startup modules and their parser order;
- `tools/build-local.sh` includes the new startup runtime smoke in the canonical local gate.

No channel mapping, Pinball key code, held-PRO behavior, relay model, display rendering, yaAGC startup sequence, Comanche rope input, or persisted snapshot schema changed in this phase.

Observed in this execution environment against the phase-30 source staged from the committed branch:

- `startup-defaults.js`, `page-resource-lifecycle.js`, `agc-snapshot-codec.js`, `camera-error-policy.js`, and `tools/startup-runtime-smoke.js` all passed `node --check`;
- `node tools/startup-runtime-smoke.js` passed, including the snapshot memory round trip and page-resource/camera policy scenarios;
- GitHub compare reports phase 30 as two commits ahead of phase 29 with only the intended startup/runtime-gate files changed.

These are source-level checks only. The current execution environment still lacks the complete recursive checkout/Android SDK build path and its shell cannot resolve GitHub, so `bash tools/build-local.sh`, Gradle regular/Fire builds, APK verification, and Android/WebView/device smokes have **not** been run for this phase. Do not upgrade those gates to verified from the source smoke.

## 2026-09-14 DSKY runtime refactor phase 1

A second audit caught an important detail the first pass missed: `index.html` does not list `flight-hardware-ui.js` or `keyboard-electrical-interlock.js` directly, but the statically loaded `cm-mode.js` installs both scripts dynamically from its window-load handler. They are therefore part of the active CM runtime. The earlier Phase-1 note that treated them as dormant was wrong and has been removed.

The effective input/transition ownership is now documented as follows:

- `keyboard-electrical-interlock.js` owns the 18 normal keycoded switches at **window capture** and preserves the series-key / KEYRST electrical model;
- `hardware-fidelity.js` owns the maintained PRO contact on channel `032`;
- `runtime-transitions.js` loads synchronously after `app.js` and the required `dream-silence.js` guard, then owns one shared CLOCK -> AGC in-flight Promise exposed through `AGCDSKY.runtimeTransitions` / `AGCDSKY_RUNTIME`;
- `runtime-transitions.js` replaces both the classic-script global `enterAgc` binding and `AGCDSKY.enterAgc` with the same serialized wrapper, so app startup, the AGC button, clock fallback input, and the electrical interlock all join the same transition;
- `clock-behavior.js` now owns only the document-level clock keypad fallback/queue and consumes the shared transition service;
- `app.js` remains the authoritative underlying AGC loader, channel decoder, display-state owner, and snapshot owner;
- once the electrical interlock is dynamically installed, physical normal-key events are stopped at window capture before the document-level clock fallback can see them.

The packaged synchronous script order for this slice is deliberately:

```text
app.js -> dream-silence.js -> runtime-transitions.js -> clock-behavior.js -> ... -> cm-mode.js
```

`dream-silence.js` remains immediately after `app.js` because the existing asset gate requires that safety guard before any later frontend layer. `runtime-transitions.js` still runs in the same script turn, before app startup timers or user input can execute.

Phase 1 removes duplicate AGC-loading coordination while preserving the existing CM-only behavior:

- the shared service serializes AGC entry through one Promise and returns that same Promise to later callers while the load is in flight;
- the already-installed app startup/AGC-button closures resolve the replaced classic-script global `enterAgc` binding at call time, so they enter through the same service without rewriting the underlying `app.js` loader;
- the previous 10 ms readiness polling fallback has been removed; an `agc-loading` state without the shared Promise is now treated as an invariant violation instead of being hidden by another polling loop;
- `keyboard-electrical-interlock.js` awaits `runtimeTransitions.requestAgc('keyboard electrical contact')` and only then asserts the original Pinball keycode on channel `015`;
- a fast touchscreen release during loading still preserves the physical cycle until the make is delivered and the minimum KEYRST dwell completes;
- queued document-level fallback contacts remain ordered and are forwarded after AGC readiness;
- direct AGC-button/startup entry preserves `app.js` failure compatibility: if the loader catches an error and falls back to clock, the app-entry Promise resolves with that final state, while keyboard/fallback callers get a derived rejection because they require a ready AGC before injecting a key;
- transition diagnostics return copied state rather than mutable production structures;
- synthetic CLOCK-mode COMP ACTY remains forbidden;
- AGC/WASM startup ordering, channel mappings, relay state, PRO semantics, snapshot format, and display rendering are unchanged by this phase.

Regression coverage was tightened in four places:

- `tools/clock-mode-behavior-smoke.js` covers ordinary fallback promotion, ordered fallback contacts during one load, a direct app/startup-style `enterAgc` call followed by a keypad join with no polling or second loader start, and app-load failure compatibility;
- `tools/keyboard-electrical-interlock-smoke.js` treats the shared transition API as the handoff contract while retaining the series-chain, PRO-bypass, fast-tap, and KEYRST checks;
- `tools/runtime-transition-integration-smoke.js` checks script order, installs the extracted transition service plus clock fallback and electrical interlock together, propagates pointer events from window to document unless actually stopped, and requires a physical VERB fast-tap during a direct app AGC load to join one transition, generate one Pinball `021` make, avoid the clock fallback/legacy editor, avoid readiness polling, and end with one KEYRST;
- `tools/asset-reference-smoke.js` now requires `runtime-transitions.js` to be packaged and locks the exact `app.js -> dream-silence.js -> runtime-transitions.js` ordering.

The transition smokes are wired into `tools/build-local.sh`. The clock behavior smoke existed previously but was not part of the canonical build gate; Phase 1 added it, and the new integration smoke is adjacent to the electrical-interlock gate.

Observed in this execution environment against source fetched from the current refactor branch:

- current `runtime-transitions.js`, `clock-behavior.js`, and `keyboard-electrical-interlock.js` passed `node --check` in a reconstructed minimal source tree;
- current transition/clock production source passed scenarios for ordinary first-key handoff, ordered fallback queuing, direct app-load joining with no second loader/poll loop, and app-load failure compatibility;
- current electrical production source passed the physical fast-tap handoff scenario: window-capture ownership, no document fallback participation, no 10 ms readiness polling, one Pinball `021` make, one KEYRST, and no latched channel-015 cycle;
- the execution container still cannot resolve `github.com`, so a complete recursive checkout and the repository's exact full smoke scripts cannot be executed directly in that container.

These are source-level checks against the current fetched production files, not a canonical full-repository build. `bash tools/build-local.sh`, Gradle regular/Fire builds, APK verification, and Android/WebView/device smokes have **not** been run for this branch in this environment. The Android SDK/recursive-checkout limitations below still apply. No device/runtime claim is upgraded from these source checks.

## 2026-09-13 WebAudio renderer recovery

A regular-phone prototype report from Android 17 / Chromium WebView 151 showed Chromium's native WebAudio renderer diagnostic:

```text
The AudioContext encountered an error from the audio device or the WebAudio renderer.
```

The failure was in the relay-audio lifecycle, not AGC/DSKY channel logic. The prior frontend kept one global `AudioContext`, retried `resume()` without handling failure, never replaced a context that had reached `closed`, and allowed the raw Chromium console error to be promoted into the next-launch prototype crash/error report.

The late `background-audio-guard.js` layer now owns bounded WebAudio recovery after all relay-audio refinements are loaded:

- every relay `AudioContext` is observed for Chromium's `error` event;
- a renderer/device failure retires and closes the failed context and clears the global reference;
- the next audible relay event may create one fresh context;
- if that replacement also fails before eight seconds of stable running audio, a circuit breaker stops automatic retries rather than creating an endless fail/recreate loop;
- the RELAY CLICKS control displays `ERROR · OFF/ON TO RETRY`, and an explicit off/on cycle resets the breaker;
- an already-`closed` context is replaced without counting that normal state as a renderer failure;
- a non-policy `resume()` rejection retires the context instead of being silently swallowed;
- `NotAllowedError` remains a user-gesture/autoplay-policy condition and does not destroy a context that may resume on a later gesture;
- Dream mode and hidden-app state still refuse to create/resume relay audio;
- stale-context relay emissions are rejected after a context has been retired.

`DebugReporter` now ignores only Chromium's exact recoverable renderer-console sentence. If bounded recovery itself fails twice, the frontend reports a distinct `WebAudio recovery failed...` detail through the local `DebugBridge`, so a genuine unrecovered audio failure still produces diagnostic evidence.

A related lifecycle bug was also fixed: `startup-defaults.js` previously retained closed `AudioContext` wrappers in its page-owned `audioContexts` set until full page teardown. Recovered/replaced contexts are now removed on the `closed` state transition, preventing dead-wrapper accumulation and keeping `AGCLifecycle.counts().audioContexts` meaningful.

`tools/audio-recovery-smoke.js` now covers renderer-error replacement, repeated-failure circuit breaking, manual retry, closed-context replacement, resume rejection, `NotAllowedError`, Dream/hidden silence, lifecycle tracking cleanup, and raw Chromium-report filtering. It is part of the canonical `tools/build-local.sh` source gate.

Observed in this execution environment:

- the edited `background-audio-guard.js` passed `node --check`;
- the new audio-recovery smoke passed against the staged edited sources;
- the edited `tools/build-local.sh` passed `bash -n`.

These are source-level checks only. The current execution environment still cannot resolve GitHub from the shell and does not provide the complete Android SDK/Gradle recursive checkout, so the canonical Android build, APK verification, and Pixel/Fire device smokes have **not** been run for this revision. The shortest acceptance step remains `bash tools/build-local.sh`, followed by the regular-phone device smoke on the Pixel-class Android 17 target.

## Current scope

The current Android app is the **CM / Comanche 055** configuration. It has two deliberately separate modes:

1. a synthetic phone-clock / DreamService presentation; and
2. a real AGC mode driven by the pinned `yaAGC` WebAssembly core and Apollo 11 Command Module `Comanche055.bin`.

The current Gradle package inputs are only:

- `vendor/webAGC/src/yaAGC.wasm` — 132,617 bytes — Git blob `713685680492098d05437b99c26403f683d56009`;
- `vendor/webAGC/demo/agc/Comanche055.bin` — 73,728 bytes — Git blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`.

The pinned `vendor/webAGC` gitlink remains:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

Normal DSKY keys use channel `015` with the Pinball codes. PRO remains a level-sensitive input on channel `032` bit `020000` and is not converted into an ordinary key event.

## 2026-09-12 phone CLOCK -> AGC input regression

The interactive phone Activity had regressed so normal DSKY commands entered while the display was in CLOCK mode no longer promoted the app into real AGC mode. The cause was the newer Block II series-key electrical interlock: it owns normal keys at **window capture** and stops propagation, while the older clock-handoff helper was listening later at **document capture**. The first physical key therefore never reached the handoff helper and fell through to the obsolete synthetic clock command-entry path instead.

The electrical interlock still owns the physical transition point, but transition serialization is now shared. For a normal key made in CLOCK mode it:

- requests the shared `AGCDSKY.runtimeTransitions.requestAgc()` transition;
- joins an already-running AGC load rather than starting another one;
- forwards that same physical keycode to channel `015` once the Comanche core is ready;
- retains the existing minimum electrical dwell and separate `keyRelease()` / KEYRST path if the touchscreen key was released while the core was loading;
- keeps PRO separate on channel `032` exactly as before;
- does not invoke the old synthetic clock command editor for the handoff key.

`tools/keyboard-electrical-interlock-smoke.js` remains the isolated electrical regression gate. `tools/runtime-transition-integration-smoke.js` is the corresponding multi-layer gate for the shared transition service, clock fallback, and physical electrical owner.

The source gates are committed. They are **not** substitutes for the current canonical local build and Android device smoke.

## 2026-09-11 original-drawing correction pass

The DSKY display source-of-truth policy was tightened. Original MIT Instrumentation Laboratory / NASA Apollo engineering drawings are now the dimensional/specification authority. In particular:

- SCD `1006315`, **INDICATOR, DIGITAL, ELECTROLUMINESCENT, SPECIFICATION CONTROL DRAWING**, is the primary source for the EL indicator;
- the `2003994-121` assembly chain establishes the DSKY/EL installation context, including the `2003988` EL-and-cover assembly;
- VirtualAGC electrical material and preserved schematics are used to cross-check relay/channel behavior;
- Ben Krasnow's `DSKY_EL_replica` SVG remains only a vector-outline transcription source for numeric segment contours that have not yet been re-entered directly from the original drawing.

### EL appearance

Current source now uses:

- gray EL glass with visible gray border/contact hardware;
- nine visible contact/ITO dots already present in the source artwork mapping;
- no synthetic neon-style spatial glow;
- black `PROG`, `VERB`, `NOUN`, and `COMP ACTY` lettering over EL phosphor sections;
- corrected visible clearance between the right-hand digit fields and the glass border;
- source-backed register separator geometry;
- production nominal **5300-angstrom / 530-nm** EL color rather than the cooler appearance of an early surviving panel.

The WebView (`--el:#79ef4f`), native widget (`Color.rgb(121,239,79)`), and generated API-31+ widget register frames (`#79EF4F`) are locked together by `tools/el-widget-smoke.js`.

The native Android home-screen widget carries the same gray glass, border/dots, black-on-EL legends, no-glow treatment, right-side field clearance, and production EL color.

### Keyboard placement

The numeric/center key rows retain their measured pitch. The four outer function keys are intentionally staggered rather than forced onto the numeric-row baselines:

- VERB and ENTR are on the intermediate upper row;
- NOUN and RSET are on the intermediate lower row.

This fixes the earlier convenience 7-column grid behavior without moving the numeric keypad.

### Sextant controls

The sextant and star-selection buttons now use the same Series-2-style option-button construction as the main app controls. This is CSS-only and does not alter optics/AGC behavior.

## CM annunciator panel

The current face is intentionally the CM layout. VirtualAGC `yaDSKY2/CM.ini` defines the two columns of seven as:

```text
11 UPLINK ACTY     21 TEMP
12 NO ATT          22 GIMBAL LOCK
13 STBY            23 PROG
14 KEY REL         24 RESTART
15 OPR ERR         25 TRACKER
16 BLANK           26 BLANK
17 BLANK           27 BLANK
```

Therefore the four lower blank positions are not missing LM `ALT` / `VEL` lamps in this CM build. Do not add LM-only annunciators to the Comanche face.

## Channel-010 physical relay model

The display is modeled as **12 selectable banks of 11 bistable relays**. Channel `010` uses the upper selector field to choose a bank; the low 11 bits are the physical bank state:

```text
B + C1..C5 + D1..D5
```

The selector field is not treated as four extra display relays.

The bank mapping remains:

- 11 → PROG pair;
- 10 → VERB pair;
- 9 → NOUN pair;
- 8 → visible R1D1 from D/right bank (C is physically present but visually unused);
- 7/6 → R1 sign/digits;
- 5/4 → R2 sign/digits;
- 3 → R2D5 + R3D1;
- 2/1 → R3 sign/digits;
- 12 → condition-light relay row.

### Individual relay behavior

`hardware-fidelity.js` keeps a separate low-11 latched state for each bank. A write computes the exact Hamming difference between the old and new 11-bit states; each changed bit is one physical bistable relay operation.

The electrical command is parallel. The simulator therefore does **not** model the eleven relays as being driven serially. It allows the documented 20 ms relay settling interval, emits separate armature/contact transients for relays that actually change state, and exposes the final optical state at the settle boundary rather than inventing an undocumented sub-20-ms visible contact order.

`relay-audio-refine.js` likewise emits one dry mechanical transient per changed bistable relay instead of collapsing a whole bank transition into one generic click.

The current sub-20-ms acoustic scatter is an approximation inside the documented settle budget; it is **not** represented as measured flight-relay pull-in timing.

## K1-K5 character contact matrix

The five character relays are no longer treated as a simple enum of blank plus digits 0-9.

`dsky-relay-matrix.js` implements the actual K1-K5 contact logic traced from the DSKY schematics by VirtualAGC `Tools/traceDSKY.py`. This means all 32 possible five-relay states have their physical EL-segment result.

The normal software codes remain exactly:

- blank `000`
- 0 `025`
- 1 `003`
- 2 `031`
- 3 `033`
- 4 `017`
- 5 `036`
- 6 `034`
- 7 `023`
- 8 `035`
- 9 `037`

The other 21 electrical states are now rendered through the contact matrix rather than incorrectly disappearing as blank.

The visually unused C five-relay field of selector 8 remains physically modeled. If Comanche drives it, its relay operations still exist even though no EL digit is connected to it.

## Other DSKY discretes

Current real-AGC mapping remains source-driven:

- channel `011` bit `00002` → COMP ACTY;
- channel `011` bit `00004` → UPLINK ACTY;
- yaAGC channel `0163` supplies TEMP, KEY REL, V/N blanking, OPR ERR, RESTART, STBY, and EL-off hardware state;
- condition-light row 12 is decoded from channel `010`.

For Comanche 055 V35, the source-backed relay-12 low-11 state remains `00650`.

## Build and verification gates

Canonical local build:

```bash
bash tools/build-local.sh
```

The current build contract requires:

- JDK 17+;
- Node.js 18+;
- Android SDK compileSdk 37;
- Android Build Tools **36.0.0 exactly**;
- stable Gradle 9.5+ (the repository can bootstrap checksum-verified Gradle 9.5.1 when network access is available);
- the exact clean pinned `vendor/webAGC` checkout.

The build runs source/policy tests, DSKY mapping/relay gates, EL-widget checks, real pinned yaAGC/Comanche host semantics, clean regular + Fire Gradle builds, and post-build APK verification.

Expected debug outputs:

```text
app/build/outputs/apk/regular/debug/app-regular-debug.apk
app/build/outputs/apk/fire/debug/app-fire-debug.apk
```

Debug package ID remains install-safe alongside the release app through the `.eltest` application-ID suffix.

## Historical 2026-09-11 host limitation

On 2026-09-11 the execution container used for the drawing/relay correction pass lacked a complete recursive checkout, Gradle/Android SDK packages, and working shell DNS to GitHub. At that point only source/host and real-Comanche WASM checks could be claimed. That limitation is preserved here for chronology but is **superseded** by the successful current-main Android/PWA CI recorded at the top of this file.

The useful 2026-09-11 evidence remains:

- the K1-K5 schematic validation produced 28 distinct physical EL patterns across 32 relay codes and reproduced the normal blank/0-9 codes;
- the CM annunciator order and blank positions were checked;
- the generated widget frames used the production EL color;
- pinned `yaAGC.wasm` + `Comanche055.bin` executed under Node and produced the expected V16N65, P00 and V35 relay/channel behavior.

Do not reuse the old environment blocker as a statement that the current repository cannot build.

## Remaining high-value fidelity work — 2026-09-20

1. The numeric EL electrodes and register sign are now transcribed from the drawing-backed `1006315G-exact.step` model instead of replica SVG artwork. Preserve that boundary with regression tests.
2. Continue tying any remaining face/key/housing placement values directly to MIT/NASA dimensions before changing them. If the surviving drawing does not resolve a value, leave it documented as derived/approximate rather than eyeballing it.
3. Keep CM and LM annunciator configurations distinct; the interactive Android configuration remains CM/Comanche-oriented.
4. Audit remaining non-latching auxiliary-relay acoustic behavior only where the indicator-driver documentation supports it; do not invent measured relay timing.
5. Continue physical portrait/landscape and real-device visual acceptance separately from source/build CI.

## Build policy — current

Local/manual `tools/build-local.sh` remains the canonical reproducible build path. The owner explicitly authorized the repository's existing GitHub Actions on 2026-09-16 for source/build verification and diagnosing stalls, so the older blanket prohibition on GitHub Actions is obsolete.

Hosted CI may verify source tests, Gradle assembly, signing and package contents. It must **not** be described as physical-device verification. Never substitute APK surgery/repacking for a real Gradle build.

## 2026-09-18 checklist / EL cross-platform parity

Current branch now carries the same checklist and EL presentation intent across Android, Apple, and PWA/web:

- unenergized EL digit/sign segments render as opaque neutral gray `#737373`, slightly lighter than the EL glass, instead of low-opacity green phosphor;
- energized EL remains the source-backed `#79EF4F` phosphor approximation;
- the in-app checklist header has a PRINT action;
- the shared print stylesheet expands every checklist section and requests 5.5 × 8 inch pages;
- Android installs a `PrintBridge` JavaScript interface and uses `PrintManager` with a 5500 × 8000 mil custom media size;
- Apple installs a WKScriptMessageHandler named `PrintBridge`; iOS/iPadOS prints through `UIPrintInteractionController` and macOS through `NSPrintOperation`, both using the same 5.5 × 8 inch geometry;
- PWA/web keeps the shared PRINT button and falls back to `window.print()`; the PWA build copies the shared assets byte-for-byte and its smoke test now checks the print markers, Apollo page size, and neutral-gray unlit EL rule;
- `tools/cheatsheet-smoke.js` now guards Android + Apple bridge installation/teardown, 5.5 × 8 inch media geometry, print-all-sections CSS, and neutral unlit EL color.

Verification performed in this environment:

- [x] changed shared JavaScript parses successfully;
- [x] changed shared CSS has balanced structure;
- [x] updated PWA smoke JavaScript parses successfully;
- [x] Apple source contains the expected native print bridge and 5.5 × 8 inch media geometry;
- [ ] Apple source has been compiled with Xcode at this exact revision;
- [ ] PWA `build-site.sh` has been executed at this exact revision;
- [ ] Android canonical Gradle build has completed at this exact revision;
- [ ] Android native print flow has been exercised on-device;
- [ ] iPhone/iPad/macOS native print flow has been exercised on-device.

The File Store contains Android SDK/build-tools/signing material used for test-package work, but there is still no complete current recursive checkout plus offline Android Gradle Plugin 9.3.0 cache in the execution container. Do not call this a canonical source build until `bash tools/build-local.sh` succeeds from the exact branch HEAD.
