# AGC DSKY Android progress

Last updated: 2026-08-29

## Goal

Ship a self-contained Android Apollo Block II DSKY with two deliberately separate modes:

1. A synthetic phone clock / charging DreamService presentation.
2. A real AGC mode driven by the pinned VirtualAGC `yaAGC` WebAssembly core and authentic AGC I/O.

AGC mode must not substitute phone traffic, random animation, or other synthetic state for real computer output. The APK remains offline with no `android.permission.INTERNET`. Device location is the only intended external runtime input and is used only for DREAM SOLAR.

## Pinned runtime

webAGC submodule revision:

```text
0575ea7a1231e3948bae7d2c22a6ac146da0c38d
```

Required exact assets:

- `vendor/webAGC/src/yaAGC.wasm` — 132,617 bytes — blob `713685680492098d05437b99c26403f683d56009`
- `vendor/webAGC/demo/agc/Luminary099.bin` — 73,728 bytes — blob `cd2ec9992d5863e1c7234fa760020f68ef946202`
- `vendor/webAGC/demo/agc/Comanche055.bin` — 73,728 bytes — blob `9e4ec167dc99ac12b233df07b6b91fef585e5015`

`agc-core.js` embeds the pinned yaAGC WASM using its exact minimal WASI import set. The lazy-I/O-safe startup sequence remains:

1. load the exact rope;
2. `cpu_reset()`;
3. disposable `cpu_step(1)` to initialize the ring-buffer backend;
4. discard transient output;
5. `cpu_reset()` again;
6. queue DSKY U-bit masks for channels `015` and `032`;
7. begin ordinary mission execution.

Normal keys use channel `015`. PRO uses channel `032` bit `020000` and remains press-and-hold capable. Luminary099 is the native/default LM path. Comanche055 is selectable, but full CM peripheral fidelity is not claimed because the pinned WASM does not export its upstream `CmOrLm` selector.

## Current Android/frontend state

- Packaged assets are served from the app's synthetic local HTTPS origin.
- WebView network, file, and content loads remain restricted; the manifest has no INTERNET permission.
- MainActivity/DreamService retain strict offline/CSP behavior and local runtime diagnostics.
- Selected mission and requested AGC/CLOCK mode persist locally.
- Same-WebView hide/show pauses and resumes the same in-memory core.
- Page/Activity/process recreation restores selected mission/requested mode but creates a fresh AGC reset; CPU/erasable memory is not serialized.
- DreamService remains a synthetic display-only clock path and must not run yaAGC.
- DREAM DIM / BRIGHT / SOLAR and polar day/night handling remain implemented.
- `FRONTEND READY` now requires the complete post-load relay diagnostic layer (`snapshotRelays` + `snapshotDsky`) in addition to the base AGCDSKY/EL/mission UI, so immediate device smoke cannot pass if `app-refine.js` failed to load.

## Relay-model checkpoint

The channel `010` path has been checked against VirtualAGC `yaDSKY2.cpp`, DSKY conversion tooling, Apollo 11 Luminary 99 and Comanche 55 Pinball/T4 sources.

### Five-relay character codes

Exact octal character codes are:

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

Unsupported five-bit patterns are invalid rather than alternate blanks. The decoder preserves the last good display/latch state and emits a rate-limited diagnostic for malformed words.

### Channel 010 matrix

- 11 → PROG D1/D2
- 10 → VERB D1/D2
- 9 → NOUN D1/D2
- 8 → visible R1D1 from D/right field
- 7/6 → R1 plus/minus and remaining digits
- 5/4 → R2 plus/minus and remaining digits
- 3 → R2D5 + R3D1
- 2/1 → R3 plus/minus and remaining digits
- 12 → condition-light relay row

The synthetic phone clock and authentic AGC decoder consume the same selector/sign topology; the duplicate `CLOCK_GROUPS` matrix is gone. Plus/minus states latch independently and plus has display priority when both are set, matching VirtualAGC.

Apollo-11-era LM relay-12 visible low-11 masks are VEL `00004`, NO ATT `00010`, ALT `00020`, GIMBAL LOCK `00040`, TRACKER `00200`, and PROG `00400`; all six = `00674`. The two unused/unplacarded positions remain blank for this Apollo 11-14 LM presentation.

Channel `011` supplies COMP ACTY (`00002`) and UPLINK ACTY (`00004`). yaAGC synthetic/modulated channel `0163` supplies TEMP, KEY REL, V/N blanking, OPR ERR, RESTART, STBY, and EL-off state.

### Timing

Luminary 99 T4RUPT supports:

- normal service cadence: **120 ms**;
- relay drive/settle phase: **20 ms**;
- relay-off phase: **20 ms**;
- successive dirty-bank writes in `QUIKDSP`: **40 ms start-to-start**.

Phone-clock mode separates the 120 ms scan cadence from the 40 ms dirty-bank sequence. Authentic AGC mode consumes yaAGC-emitted channel words without adding this synthetic scheduler.

## V35 FULLDSP checkpoint

Both Apollo-11 ropes use:

- `FULLDSP = 05675`
- `FULLDSP1 = 07675`
- `TSTCON1 = 00175`
- `SHOLTS = 0764` (about five seconds)

After masking to channel-010 low 11 bits:

- ordinary numeric rows carry **`01675`**;
- plus-sign rows 7, 5, and 2 carry **`03675`**.

Relay selector 8 visibly connects only its D/right five-relay character bank to R1D1, but V35 still drives its otherwise unused C bank to digit-8 code `035`. Therefore relay 8 is also low-11 **`01675`**, not merely `00035`. The renderer ignores the unconnected field while the physical relay/click state retains it.

Mission-specific V35 relay-12 source words differ:

- Luminary099 `TSTCON2 = 40674` -> low-11 **`00674`**.
- Comanche055 `TSTCON2 = 40650` -> low-11 **`00650`**.

The host semantic gate now verifies the exact raw relay-12 word for each rope rather than applying LM annunciator semantics to Comanche.

## Synthetic clock V35 ownership/cancellation

Clock-mode V35:

- uses channel-010 relay words rather than direct `88` DOM painting;
- runs for five seconds;
- asserts Luminary's six LM relay-12 lights and UPLINK without forcing COMP ACTY;
- mirrors yaAGC's 1.28-second / 75% V/N + KEY REL/OPR ERR modulation;
- ignores ordinary DSKY keys while the test owns the display, except RSET.

A bug found during refinement was that app.js's base RSET repaints clock state but does **not** call `cancelLampTest()`. Allowing RSET through without explicit cancellation left the five-second timeout / 320 ms flash interval alive.

`app-refine.js` now explicitly calls `cancelLampTest()` before base RSET. AGC-mode entry and mission changes use the same explicit cancel -> base RSET -> transition ordering. The regression deliberately mocks base RSET as *not* cancelling V35, so this mistake cannot be hidden by the test harness again. `tools/v35-model-smoke.js` separately verifies that `cancelLampTest()` still clears both asynchronous timers and the active ownership flag.

These post-load corrections remain intentionally narrow. `app-refine.js` must not become a second application implementation; mature logic should move into app.js when a safe full-source edit path is available.

## Relay-aware diagnostics and automated gates

`app-refine.js` exposes read-only diagnostic copies:

- `AGCDSKY.snapshotRelays()`
- `AGCDSKY.snapshotDsky()`

They expose relay/render/lamp state for smoke tests without mutable references to production relay tables.

Canonical source/build gates now include:

- `tools/dsky-mapping-smoke.js` — selectors 1-12, visible numerical positions, signs, LM relay-12 lights, malformed-code behavior, channel mappings, and shared topology.
- `tools/app-refine-smoke.js` — relay-8 FULLDSP, V35 input ownership, explicit RSET/AGC/mission cancellation ordering, and immutable diagnostics.
- `tools/v35-model-smoke.js` — effective app.js + refinement model, including `01675`/`03675`, relay-8 unused C bank, Luminary relay-12, COMP exclusion, five-second duration, flash modulation, and actual timer-cancel contract.
- `tools/wasm-runtime-smoke.js` — real pinned yaAGC + both ropes. It requires `V37E00E` to leave channel-010 PROG `00` / relay-11 low-11 **`01265`** before V35, then requires FULLDSP/FULLDSP1 in both physical character banks, plus signs, and exact mission relay-12 (`00674` LM / `00650` CM).
- `tools/build-local.sh` invokes all of the above before Gradle.

The live Android `tools/device-v35-smoke.js` uses the diagnostic surface and, for real Luminary, requires:

- actual pointer-driven `V37E00E` followed by channel-driven PROG `00` / relay-11 low-11 `01265` before V35 is issued;
- exact V35 low-11 states: `01675` ordinary rows, `03675` plus rows, relay 8 `01675`, relay 12 `00674`;
- rendered PROG/VERB/NOUN `88` and R1/R2/R3 `+88888`;
- UPLINK, TEMP, NO ATT, GIMBAL LOCK, STBY, PROG, RESTART, TRACKER, ALT, VEL on;
- KEY REL and OPR ERR on during a visible phase;
- COMP ACTY off;
- no synthetic clock `lampTestActive` state;
- a subsequent real yaAGC-modulated off phase with V/N blanked and KEY REL / OPR ERR suppressed while steady lamps/relay latches remain.

This distinguishes AGC relay-output faults from frontend-rendering faults and is stronger than observing a screen full of 8s.

## Package verification refinement

`tools/verify-apk.sh` no longer relies on a hand-maintained frontend file list. It first byte-compares packaged `index.html`, then dynamically discovers every local `src=` / `href=` reference in current source and byte-compares the corresponding packaged asset. `BUILD_SOURCE.txt` remains explicitly verified, and the three pinned binary blobs remain exact Git-blob checks.

This closes the packaging hole where a required layer such as `app-refine.js` could otherwise be absent/stale while an older manual verifier list still passed.

## Verification boundary

This pass refined source, tests, and documentation only. The current complete revision has **not** been built or run against the pinned WASM/ropes or an Android device in this restricted execution environment. The shell here does not have the complete private recursive checkout/Android SDK toolchain needed for the canonical build.

I did separately validate the Bash dynamic-reference pattern used by the APK verifier and the JavaScript cross-script reassignment pattern used by the refinement layer. Those are narrow source checks, not a substitute for the canonical build/runtime gates.

Do not report the strengthened gates as passing until they are actually executed against the corresponding source revision.

Hard checkpoint:

```bash
bash tools/build-local.sh
bash tools/device-full-smoke.sh app/build/outputs/apk/debug/app-debug.apk
```

## Remaining acceptance gates

- [ ] Exact recursive checkout and pinned binary verification pass.
- [ ] Canonical local build and APK verifier pass.
- [ ] APK installs/launches on target Android/GrapheneOS.
- [ ] Real relay-aware Luminary V35 device gate passes with P00 `01265` and V35 `01675`/`03675`/`00674` states.
- [ ] Host Comanche V35 produces exact raw relay-12 `00650` as source specifies.
- [ ] Representative non-V35 Pinball semantics work through channel `015`.
- [ ] Long physical PRO hold produces intended behavior through channel `032`.
- [ ] Real OS screen-off/on preserves a surviving in-memory core.
- [ ] Page/process recreation restores mission/requested mode from a fresh reset.
- [ ] DreamService startup/display-only behavior is verified through Android UI.
- [ ] DREAM DIM / BRIGHT / SOLAR and first-use location permission are verified physically.
- [ ] DISPLAY crop/scaling is visually verified in portrait and landscape.

## Known limitations

1. Full CM peripheral fidelity is not claimed because the pinned WASM exposes no `CmOrLm` setter.
2. Exact CPU/erasable-memory continuation across process death is not implemented.
3. Android/WebView/compositor/permission/DreamService behavior remains the hard runtime verification boundary.
4. The original private signing key is not committed; a differently signed local APK cannot update the old signed app in place.
5. Old reconstructed/repacked APKs are not evidence for this source revision.

## Build policy

Builds remain local/manual. Do not add GitHub Actions, Codespaces, or another hosted build service. The canonical local path may use a system Gradle or the repository's checksum-verified Gradle 9.5.1 bootstrap, but still requires the Android SDK/platform/build-tools locally.
