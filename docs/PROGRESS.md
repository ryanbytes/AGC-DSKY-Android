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

## Relay-model checkpoint

The channel `010` path has been checked against VirtualAGC `yaDSKY2.cpp`, its DSKY conversion tooling, Apollo 11 Luminary 99 `T4RUPT_PROGRAM.agc`, and `PINBALL_GAME__BUTTONS_AND_LIGHTS.agc`.

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
- 12 → LM condition-light relays

The synthetic phone clock and authentic AGC decoder now consume the same selector/sign topology; the duplicate `CLOCK_GROUPS` matrix is gone. Plus/minus states latch independently and plus has display priority when both are set, matching VirtualAGC.

Apollo-11-era relay-12 visible low-11 masks are VEL `00004`, NO ATT `00010`, ALT `00020`, GIMBAL LOCK `00040`, TRACKER `00200`, and PROG `00400`; all six = `00674`. The two unused/unplacarded positions remain blank for this Apollo 11-14 LM presentation.

Channel `011` supplies COMP ACTY (`00002`) and UPLINK ACTY (`00004`). yaAGC synthetic/modulated channel `0163` supplies TEMP, KEY REL, V/N blanking, OPR ERR, RESTART, STBY, and EL-off state.

### Timing

Luminary 99 T4RUPT supports:

- normal service cadence: **120 ms**;
- relay drive/settle phase: **20 ms**;
- relay-off phase: **20 ms**;
- successive dirty-bank writes in `QUIKDSP`: **40 ms start-to-start**.

Phone-clock mode now separates the 120 ms scan cadence from the 40 ms dirty-bank sequence. Authentic AGC mode continues to consume the yaAGC-emitted channel words without adding this synthetic scheduler.

## V35 FULLDSP refinement checkpoint

Luminary 99 `VBTSTLTS` explicitly defines:

- `FULLDSP = 05675`
- `FULLDSP1 = 07675`
- `TSTCON1 = 00175`
- `TSTCON2 = 40674`
- `SHOLTS = 0764` (about five seconds)

After the display code masks to channel-010 low 11 bits:

- ordinary numeric relay rows carry **`01675`**;
- plus-sign rows 7, 5, and 2 carry **`03675`**;
- relay 12 carries **`00674`** for the six Apollo-11 LM condition lights.

A subtle physical-model correction was made in this pass: relay selector 8 visibly connects only its D/right five-relay character bank to R1D1, but V35 still drives its otherwise unused C bank to digit-8 code `035`. Therefore V35 relay 8 is also low-11 **`01675`**, not merely `00035`. The renderer continues to ignore the unconnected C field, while the physical relay state/click model retains those five transitions.

Clock-mode V35 now:

- uses channel-010 relay words rather than direct `88` DOM painting;
- runs for five seconds;
- asserts the six LM relay-12 lights and UPLINK without forcing COMP ACTY;
- mirrors yaAGC's 1.28-second / 75% V/N + KEY REL/OPR ERR modulation;
- ignores ordinary DSKY keys while the test owns the display, except RSET;
- executes the normal RSET cleanup path before entering AGC mode or changing mission, preventing synthetic V35 timers from leaking into the next mode.

These post-load corrections currently live narrowly in `app-refine.js`. This file must not become a second application implementation; mature logic should move back into `app.js` when a safe full-source edit path is available.

## Relay-aware diagnostics and automated gates

`app-refine.js` exposes read-only diagnostic copies:

- `AGCDSKY.snapshotRelays()`
- `AGCDSKY.snapshotDsky()`

They expose current relay/render/lamp state for smoke tests without giving callers mutable references to production relay tables.

Canonical source/build gates now include:

- `tools/dsky-mapping-smoke.js` — selectors 1-12, visible numerical positions, signs, LM relay-12 lights, malformed-code behavior, channel mappings, and shared topology.
- `tools/app-refine-smoke.js` — V35 key isolation, RSET escape, AGC/mission cleanup ordering, relay-8 FULLDSP physical drive, and immutable diagnostics.
- `tools/v35-model-smoke.js` — effective `app.js` + `app-refine.js` V35 model; requires both C/D five-relay banks at code `035` on every numeric row, low-11 `01675`/`03675`, relay-12 `00674`, COMP exclusion, five-second duration, and 1.28-second/75% modulation.
- `tools/wasm-runtime-smoke.js` — real pinned yaAGC + both ropes; drives `V37E00E` then `V35E` and now requires FULLDSP digit-8 codes in **both physical five-relay banks on selectors 1-11**, plus-sign bits, and for Luminary the six relay-12 condition lights.
- `tools/build-local.sh` invokes the above before Gradle.

The live Android `tools/device-v35-smoke.js` now uses the read-only diagnostic surface and requires, from the real Luminary path:

- exact channel-010 low-11 states: `01675` ordinary rows, `03675` plus rows, relay 8 `01675`, relay 12 `00674`;
- rendered PROG/VERB/NOUN `88` and R1/R2/R3 `+88888`;
- UPLINK, TEMP, NO ATT, GIMBAL LOCK, STBY, PROG, RESTART, TRACKER, ALT, VEL on;
- KEY REL and OPR ERR on during a visible phase;
- COMP ACTY off;
- no synthetic clock `lampTestActive` state;
- a subsequent real yaAGC-modulated off phase with V/N blanked and KEY REL / OPR ERR suppressed while steady lamps and relay latches remain.

This distinguishes AGC relay-output faults from frontend-rendering faults and is stronger than merely observing a screen full of 8s.

## Verification boundary

This pass refined source, tests, and documentation only. The current complete revision has **not** been built or run against the pinned WASM/ropes or an Android device in this restricted execution environment. The shell here does not have the complete private recursive checkout/Android SDK toolchain needed for the canonical build.

Do not report these strengthened gates as passing until they are actually executed against the corresponding source revision.

Hard checkpoint:

```bash
bash tools/build-local.sh
bash tools/device-full-smoke.sh app/build/outputs/apk/debug/app-debug.apk
```

## Remaining acceptance gates

- [ ] Exact recursive checkout and pinned binary verification pass.
- [ ] Canonical local build and APK verifier pass.
- [ ] APK installs/launches on target Android/GrapheneOS.
- [ ] Real relay-aware V35 device gate passes with the exact `01675`/`03675`/`00674` states above.
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
