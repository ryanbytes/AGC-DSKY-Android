# Implementation notes

## Evolution through v6

### Early builds

The first Android shell demonstrated the basic idea but had several visual/runtime problems seen on the test phone:

- DSKY rendered off-center.
- Android title/action chrome remained visible.
- Faceplate was a modern-looking approximation rather than Apollo hardware.
- Keyboard initially used the wrong arrangement.
- Numeric display fields were compressed because percentage-based layout distorted individual digits.

### Geometry corrections

Apollo-derived artwork established the front-face coordinate system at roughly 320×372 and confirmed:

- 19 keys in a 7-column × 3-row layout with intentional empty positions.
- 14 annunciator positions in two columns of seven.
- Two blank annunciator positions in the Apollo 11-era LM map.
- Full numeric glyph envelope: 14×24 reference units.
- Sign envelope: 7×24 reference units.

v5 fixed the major width bug by sizing the display from those envelopes.

### v6 EL display

v6 replaced independent HTML/flex digit fields with one SVG display coordinate system (`viewBox="0 0 106 190"`). This prevents the browser from giving PROG/VERB/NOUN/register glyphs different aspect ratios.

The segment geometry uses custom paths rather than generic CSS rectangles. The current paths use slim chamfered horizontal elements, only a slight lean in vertical elements, restrained unlit ghosts/blur, and a three-element sign cell. COMP ACTY, labels, separator rules, and all numeric fields occupy the same SVG glass coordinate system.

## Historical network-driven COMP ACTY

The v6 clock shell temporarily repurposed COMP ACTY as aggregate phone-network activity using `TrafficStats` and an `agcnet://poll` WebView bridge.

That implementation is obsolete and removed from v0.7. It must not be reintroduced as AGC behavior. In AGC mode, COMP ACTY is driven only by Block II output channel `011` octal, bit 2.

## v0.7 onboard AGC architecture

### Pinned core

`vendor/webAGC` is pinned at:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

Required upstream inputs are:

- `src/yaAGC.wasm`
- `demo/agc/Luminary099.bin`
- `demo/agc/Comanche055.bin`

A recursive checkout is required. The Android build does **not** package the whole upstream `src` or `demo/agc` trees: Gradle stages only the three required verified binaries into generated assets. The source/build/APK gates reject missing, changed, or stale copies and check the exact pinned Git blobs.

### Synthetic HTTPS asset origin

MainActivity and DreamService load:

`https://appassets.androidplatform.net/assets/...`

`NetClient` serves matching paths directly from Android `AssetManager`. It rejects traversal/separator tricks and uses URI path segments rather than substring arithmetic. This is strictly an offline resource mechanism; WebView network loads are blocked and the merged app must not request INTERNET.

### Minimal WASI wrapper

The pinned `yaAGC.wasm` imports exactly `env.memory` plus WASI Preview 1:

- `fd_close`
- `fd_fdstat_get`
- `fd_seek`
- `fd_write`

`agc-core.js` supplies these locally and uses yaAGC exports for fixed-memory loading, reset, stepping, packet I/O, and optional version reporting.

The canonical host preflight (`tools/wasm-runtime-smoke.js`) is designed to instantiate the **actual pinned binary**, load both actual ropes, run CPU/input paths, and execute a real Pinball semantic sequence before Gradle starts. The current repository changes still require execution in a complete local checkout before this is claimed as passing for the current revision.

### AGC mission selection

Apollo 11 LM `Luminary099.bin` is the default rope. Hidden controls also select CM `Comanche055.bin`.

- Mission choice persists locally.
- Changing mission during AGC mode stops the current core and starts the selected rope from reset.
- Changing mission in phone-clock mode changes only the next selected AGC mission.
- DreamService never starts yaAGC.

The pinned WASM's internal `CmOrLm` global defaults LM and is not exported. Comanche remains a real/selectable CM rope for DSKY execution, but full CM peripheral-mode fidelity is not claimed.

### AGC clocking and lifecycle

The wrapper follows webAGC's approximate timing model (~11.72 μs per AGC instruction with a JavaScript scheduling/drain loop). A catch-up cap prevents a delayed WebView timer from running an unbounded burst.

Lifecycle distinction:

- same surviving WebView: AGC timer pauses while hidden and resumes the same in-memory core;
- page/Activity/process recreation: selected mission/requested mode persist, but a fresh yaAGC reset is constructed;
- CPU registers and erasable memory are not serialized across process/page destruction.

### DSKY output relay model

Channel `010` is interpreted as:

`WWWWBCCCCCDDDDD`

where W selects a relay row, B is the row discrete/sign bit, and C/D are five-relay character states.

The character relay codes are source-backed, not decimal assumptions. The current code has one selector/sign topology shared by real AGC output decoding and synthetic phone-clock relay generation. Invalid five-bit character patterns are rejected rather than silently treated as blank.

Visible mapping covers PROG, VERB, NOUN, all 15 register digits, R1/R2/R3 signs, and the six Apollo-11-era LM relay-12 condition lights. Channel `011` supplies COMP ACTY and UPLINK ACTY. yaAGC synthetic/modulated channel `0163` supplies TEMP, KEY REL, OPR ERR, RESTART, STBY, V/N blanking, and EL-off state.

The relay/click model counts low-11 latch changes, including physically driven fields that have no visible connection. The important V35 example is selector 8: ordinary display rendering uses only its D field for R1D1, but Luminary `FULLDSP` still drives the unused C five-relay bank.

### Relay timing

Luminary 99 T4RUPT provides three distinct timing scales used by the synthetic clock hardware model:

- normal display service: 120 ms;
- relay-drive/settle: 20 ms;
- quick dirty-bank sequence: 40 ms start-to-start (20 ms drive + 20 ms off).

Authentic AGC mode does not add that synthetic scheduler; it consumes yaAGC's emitted channel words.

### V35 light-test model

Luminary 99 `VBTSTLTS` defines the current source-backed light-test behavior:

- `FULLDSP = 05675` -> low-11 `01675`
- `FULLDSP1 = 07675` -> low-11 `03675` on plus rows 7/5/2
- `TSTCON2 = 40674` -> relay-12 low-11 `00674`
- `TSTCON1 = 00175`
- TEST ALARM drives RESTART/STBY behavior
- `SHOLTS = 0764`, approximately five seconds

Both physical five-relay character banks carry digit code `035` on every numeric V35 row, including selector 8's visually unused C bank. COMP ACTY is not part of the V35 test mask.

yaAGC's hardware model uses a 1.28-second DSKY flash period with 75% duty cycle; its off quarter blanks V/N and suppresses KEY REL/OPR ERR. Real AGC mode follows channel `0163`. Phone-clock V35 mirrors this modulation locally because no engine is running.

Synthetic V35 now owns its display for the test duration: ordinary keys are ignored except RSET. RSET explicitly calls `cancelLampTest()` before base clock reset, and AGC/mission transitions use the same explicit cancellation barrier so neither the five-second timeout nor 320 ms interval can leak into another mode.

### Refinement/diagnostic layer

`app-refine.js` is a deliberately narrow post-load layer currently used for:

- selector-8 FULLDSP physical-state correction;
- synthetic V35 key ownership and explicit timer cancellation on RSET/mode/mission transitions;
- read-only `AGCDSKY.snapshotRelays()` / `snapshotDsky()` diagnostics used by device smokes.

It must not grow into a second implementation of the app. Mature logic should be folded back into `app.js` when a safe full-source edit path is available.

The debug frontend readiness marker now requires these diagnostic functions, so `FRONTEND READY` proves the full script stack—not only base `app.js`—initialized.

### DSKY input

Normal keys use input channel `015` with original Pinball five-bit codes. PRO is separate: channel `032`, bit 14 (`20000` octal), held for actual pointer duration.

Peripheral U-bit masks are:

- channel `015`: `00037`
- channel `032`: `20000`

The ring-buffer backend initializes lazily, so the wrapper must preserve rope load -> reset -> disposable step -> output discard -> reset -> U-bit mask sequence.

## DreamService

`AgcDreamService` loads the same local page with dream/display query state. It has a separate WebView, remains synthetic clock/display-only, hides interaction controls, supports DIM/BRIGHT/SOLAR, sets window brightness through `DreamBridge`, and applies small periodic position drift.

Dream presentation must not cause MainActivity to inherit display-only/clock state. Same-origin WebStorage is intentionally shared because Activity and DreamService remain in the same app process/origin.

## Build and verification policy

Per owner instruction:

- no GitHub Actions/Codespaces/hosted builds;
- build and test locally/manual;
- never claim build/install/runtime success without observing it;
- never substitute reconstructed/repacked DEX/APK surgery for the real Gradle application.

`tools/build-local.sh` is the canonical source/build entrypoint. It syntax-checks helper scripts, runs policy/frontend/relay/refinement tests, runs the real-WASM host semantic gate, builds cleanly, and runs APK verification.

`tools/verify-apk.sh` independently verifies exact upstream binary blobs, APK metadata/permissions/signature, and dynamically discovers every local `src=`/`href=` frontend asset in current `index.html` for byte-for-byte source comparison. This prevents a required layer such as `app-refine.js` from being accidentally omitted from package verification.

The preferred Android checkpoint is:

```bash
bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk
```

Its V35 semantic driver now proves a channel-driven P00 `PROG 00` precondition before V35, exact FULLDSP/FULLDSP1 relay latches, rendered `88` / `+88888`, expected annunciators with COMP excluded, and a real yaAGC-modulated V/N + KEY REL/OPR ERR off phase.

## Remaining high-value work

1. Run `tools/build-local.sh` in a complete recursive checkout with Android SDK platform 37 / Build Tools 36.0.0 and record the exact results.
2. Run `tools/device-full-smoke.sh` on the current APK and retain its evidence.
3. If V35 fails, inspect `snapshotDsky()` to distinguish relay-output, annunciator/modulation, and SVG-rendering failures before weakening any gate.
4. Exercise representative non-V35 Pinball semantics through real channel `015` input.
5. Test long physical PRO behavior through channel `032`.
6. Verify real OS screen-off/on lifecycle behavior in addition to direct bridge tests.
7. Verify DreamService startup, non-interactivity, brightness modes, SOLAR permission behavior, and normal-app state after Dream exit.
8. Perform physical portrait/landscape DISPLAY and pixel-level DSKY visual review.
9. If exact CM peripheral mode becomes necessary, rebuild audited yaAGC with an explicit exported LM/CM setter rather than patching the pinned binary.
