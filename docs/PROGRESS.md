# AGC DSKY Android progress

Last updated: 2026-09-10

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
- `FRONTEND READY` now requires `snapshotRelays()`, `snapshotChannels()`, and `snapshotDsky()` in addition to rendered EL/mission UI, so a partial post-load refinement cannot pass immediate device smoke.

## Amazon Fire HOME startup

`SensorMainActivity` retains separate `MAIN`/`LAUNCHER` and
`MAIN`/`HOME`/`DEFAULT` filters and remains exported. Those properties are
unchanged between the corrected v1.0 HOME release (`12584f5`) and v1.1.1; there
was no activity rename, alias, package/application-ID, launch-mode, or
task-affinity regression in the main manifest.

The Fire-specific regression is commit `1a4d43a`: it removed the `fire` product
flavor, manifest overlay, `FireBootReceiver`, `FireModeActivity`, and
`FireRedirectAccessibilityService`. The connected tablet retained the old
service name in `enabled_accessibility_services`, but v1.1.1 no longer packaged
the component. Android v1.1.2 (`20051`) restores those components only in the
Fire flavor; the regular flavor remains free of Fire boot/accessibility code.

On Fire OS 7.3.2.9, `set-home-activity` can report success and persist DSKY as
the preferred HOME while `resolve-activity` still chooses Amazon's priority-50
launcher. This tablet's firmware also rejects package and component disable
with `SecurityException: Cannot disable a protected package`.
`tools/fire-tablet-home-setup.sh` verifies DSKY's launcher/HOME candidacy before
changing Amazon Home, uses native HOME when Fire Launcher can be disabled, and
otherwise activates the restored same-package redirect. Both paths require
foreground and reboot checks; failures re-enable Amazon Home.

## EL-only home-screen widget

The v0.17 source adds a resizable Android home-screen widget whose render surface is **only the electroluminescent display section**. The widget does not draw or lay out the DSKY faceplate, bezel, screws/fasteners, annunciator bank, keyboard, app controls, captions, or Dreaming-mode chrome.

The widget uses a single zero-padding `ImageView` and a native bitmap renderer with the same `106 x 190` EL coordinate system as `svg#elpanel`. It renders only:

- dim/unlit `COMP ACTY`;
- `PROG 00`;
- `VERB 16` / `NOUN 65`;
- the three register separator rules;
- `R1`, `R2`, and `R3` clock values with signs.

The numeric strokes are not a generic seven-segment font. `ElWidgetProvider.ElRenderer` ports the same crew-facing Ben Krasnow `DSKY V2.svg` EL-segment polygons and logical handedness used by `dsky-geometry.js`. `THIRD_PARTY.md` records that geometry source and MIT attribution.

The widget is horizontally/vertically resizable, re-renders when launcher size options change, opens `MainActivity` when tapped, and requests minute-level refreshes with a non-wakeup `AlarmManager.RTC` repeating alarm. Android may batch inexact alarms, so the widget must not be described as a guaranteed second-accurate clock. System `TIME_SET` and `TIMEZONE_CHANGED` broadcasts also cause a redraw/reschedule.

The widget adds no network permission and no exact-alarm permission. `tools/el-widget-smoke.js` is a source gate that requires the one-`ImageView` layout, 106:190 renderer, EL labels/register path, offline manifest, resizable metadata, non-wakeup scheduling, and forbids rectangle/rounded-rectangle/circle/oval drawing primitives that would normally reintroduce a bezel or fastener into the widget renderer.

## Channel-010 relay checkpoint

The DSKY relay path has been checked against VirtualAGC DSKY tooling and Apollo 11 Luminary/Comanche source.

Exact five-relay character codes, octal:

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

Selector matrix:

- 11 → PROG D1/D2
- 10 → VERB D1/D2
- 9 → NOUN D1/D2
- 8 → visible R1D1 from D/right field
- 7/6 → R1 plus/minus and remaining digits
- 5/4 → R2 plus/minus and remaining digits
- 3 → R2D5 + R3D1
- 2/1 → R3 plus/minus and remaining digits
- 12 → condition-light relay row

The synthetic phone clock and authentic AGC decoder consume the same selector/sign topology. Plus/minus latch independently and plus has display priority if both are set, matching VirtualAGC.

Apollo-11-era LM relay-12 visible low-11 masks are VEL `00004`, NO ATT `00010`, ALT `00020`, GIMBAL LOCK `00040`, TRACKER `00200`, and PROG `00400`; all six = `00674`.

Channel `011` supplies COMP ACTY (`00002`) and UPLINK ACTY (`00004`). yaAGC synthetic/modulated channel `0163` supplies TEMP, KEY REL, V/N blanking, OPR ERR, RESTART, STBY, and EL-off state.

## Timing checkpoint

Luminary 99 T4RUPT supports:

- normal display-service cadence: **120 ms**;
- relay drive/settle phase: **20 ms**;
- relay-off phase: **20 ms**;
- successive dirty-bank writes in `QUIKDSP`: **40 ms start-to-start**.

Phone-clock mode separates the 120 ms scan cadence from the 40 ms dirty-bank sequence. Authentic AGC mode consumes yaAGC-emitted channel words without adding the synthetic clock scheduler.

## V35 source checkpoint

Both Apollo-11 ropes use:

- `FULLDSP = 05675`
- `FULLDSP1 = 07675`
- `TSTCON1 = 00175`
- `SHOLTS = 0764` (about five seconds)

After channel-010 low-11 masking:

- ordinary numeric rows carry **`01675`**;
- plus-sign rows 7, 5, and 2 carry **`03675`**.

Relay selector 8 visibly connects only its D/right character bank to R1D1, but V35 still drives its otherwise unused C bank to digit-8 code `035`. Therefore relay 8 is also low-11 **`01675`**. The renderer ignores that unconnected field while the physical relay/click state retains it.

Mission-specific V35 relay-12 source words differ:

- Luminary099 `TSTCON2 = 40674` -> low-11 **`00674`**.
- Comanche055 `TSTCON2 = 40650` -> low-11 **`00650`**.

The host semantic gate verifies the exact raw relay-12 word for each rope.

## Synthetic clock V35 refinement

Clock-mode V35 now:

- uses channel-010 relay words rather than direct `88` DOM painting;
- runs for five seconds;
- drives Luminary's six LM relay-12 lights and UPLINK without inventing COMP ACTY;
- mirrors yaAGC's 1.28-second / 75% V/N + KEY REL/OPR ERR modulation;
- ignores ordinary DSKY keys while the test owns the display, except RSET;
- naturally returns to canonical **V16 N65** after five seconds through the same base RSET path used by an operator escape.

Current source truth for cancellation:

- base `app.js` clock RSET **already calls `cancelLampTest()`**;
- base `enterAgc()` **already calls `cancelLampTest()`** before AGC startup;
- base `cycleMission()` does not own V35 cancellation, so `app-refine.js` routes an active clock V35 through base RSET before changing the selected rope.

The refinement does not duplicate cancellation where the base implementation already owns it.

### Physical transition accounting

Before synthetic V35 starts, the refinement captures the actual clock relay state: current clock register latches plus PROG `00`, entered VERB/NOUN, and current condition-lamp row. The first `FULLDSP/FULLDSP1` writes are compared against that state, so relay-click Hamming deltas represent the physical transition into V35 rather than an invented empty starting point.

After V35 is latched, the refinement retains a one-shot copy of the active V35 relay state. RSET or natural completion computes the corresponding relay changes back to PROG `00`, V16 N65, the current time, and the cleared clock condition row before ordinary `syncClockFace()` renders the clock. Entering real AGC discards this synthetic return snapshot because the AGC reset/output path immediately takes display ownership.

## Real AGC V35 COMP ACTY correction

An earlier live-device assertion incorrectly required COMP ACTY to be off during real V35.

Source review shows why that is invalid: V35's own `TSTCON1` does not force channel 011 bit 2, but Luminary's Executive normally controls COMP ACTY while Executive jobs run or idle. V35 executes as a job, so either COMP state can legitimately be observed depending on the sampled Executive state.

The live invariant is now:

- rendered COMP == raw channel `011` bit `00002`;
- rendered UPLINK == raw channel `011` bit `00004`.

The gate likewise compares TEMP, KEY REL, V/N blanking, OPR ERR, RESTART, STBY, and EL-off against the contemporaneous raw channel `0163` word. This tests the decoder rather than assuming a convenient lamp state.

Synthetic clock V35 remains separate: because no AGC/Executive is running there, it does not invent COMP ACTY.

## Read-only diagnostics

`app-refine.js` exposes copied diagnostic state:

- `AGCDSKY.snapshotRelays()`
- `AGCDSKY.snapshotChannels()`
- `AGCDSKY.snapshotDsky()`

The raw channel snapshot records the most recent channel `011` and `0163` values plus the mode that produced them. Returned objects are copies, not mutable references to production state.

## Automated gates now in source

- `tools/dsky-mapping-smoke.js` — selector matrix, digit codes, signs, relay-12 lamps, malformed-code behavior, shared topology and base channel mappings.
- `tools/app-refine-smoke.js` — relay-8 FULLDSP, clock→V35→clock Hamming deltas, five-second natural V16 N65 return, V35 input ownership, RSET/AGC/mission transitions, immutable relay/raw-channel diagnostics.
- `tools/v35-model-smoke.js` — effective synthetic V35 model, including `01675`/`03675`, relay 8's unused C bank, Luminary relay-12, synthetic COMP exclusion, duration and flash model.
- `tools/device-v35-policy-smoke.js` — source guard forbidding a fixed real-V35 COMP-off assertion and requiring raw channel `011`/`0163` comparisons.
- `tools/wasm-runtime-smoke.js` — real pinned yaAGC + both ropes; first proves non-V35 `V16N65E` through channel `015` by checking exact VERB 16 relay-10 low-11 `00174`, NOUN 65 relay-9 low-11 `01636`, no channel-`0163` OPR ERR, and post-ENTER numeric-register output; then proves `V37E00E` reaches PROG `00` / relay-11 low-11 `01265` and V35 FULLDSP/FULLDSP1 with exact mission relay-12 (`00674` LM / `00650` CM).
- `tools/agc-core-smoke.js` — wrapper reset/input/rope/load invariants plus 60 Hz scheduler cadence, idempotent start, over-100000-step backlog rebase, stop/restart behavior, and clock-divisor application.
- `tools/device-agc-smoke.js` — real packaged WebView/yaAGC device gate for both ropes; now requires a two-second level-sensitive PRO pointer hold to remain asserted, verifies ordinary release, and separately pauses visibility while PRO is still held so the pressed state must clear before the same in-memory core resumes.
- `tools/runtime-debug-smoke.js` — readiness cannot fire until relay/raw-channel/Dsky diagnostics all exist.
- `tools/el-widget-smoke.js` — EL-only widget resource/native-source policy: single ImageView, 106:190 EL renderer, required labels/registers, resize metadata, offline manifest, non-wakeup minute scheduler, and no bezel/fastener drawing primitives.
- `tools/build-local.sh` invokes the host functional source gates before Gradle, in addition to syntax checks over all helpers. Device gates remain explicit post-build commands.

## Live Android V35 gate

`tools/device-v35-smoke.js` now requires, from real Luminary:

- actual pointer-driven `V37E00E` followed by channel-driven PROG `00` / relay-11 low-11 `01265` before V35 is issued;
- exact V35 low-11 states: `01675` ordinary rows, `03675` plus rows, relay 8 `01675`, relay 12 `00674`;
- rendered PROG/VERB/NOUN `88` and R1/R2/R3 `+88888`;
- UPLINK, TEMP, NO ATT, GIMBAL LOCK, STBY, PROG, RESTART, TRACKER, ALT, VEL on;
- KEY REL and OPR ERR on during an observed visible phase;
- no synthetic clock `lampTestActive` state;
- raw channel-011 and channel-0163 values tagged as coming from AGC mode;
- every rendered channel-011/channel-0163 discrete equal to the corresponding raw bit, including COMP ACTY;
- a subsequent real yaAGC-modulated off phase with V/N blanked and KEY REL / OPR ERR suppressed while steady relay/lamp state remains, again consistent with the contemporaneous raw channel-0163 word.

This distinguishes AGC output faults, frontend decoder faults, and renderer faults. It is stronger than observing a screen full of 8s.

## Package verification

`tools/verify-apk.sh` byte-compares source `index.html`, dynamically discovers every local `src=` / `href=` asset referenced by that page, and byte-compares each packaged counterpart. `BUILD_SOURCE.txt` remains explicitly checked, and the three pinned upstream binaries retain exact Git-blob verification.

This prevents a required frontend layer such as `app-refine.js` from being missing or stale while an older hand-maintained verifier list passes.

## Verification boundary

The v1.1.2 regular and Fire debug APKs were built locally with Android SDK 37,
Build Tools 36.0.0, Gradle 9.5.1, Java 25, and the exact pinned webAGC
submodule. The canonical host suite and real Comanche055 yaAGC WASM semantic
gate passed. `aapt2` inspection of both APKs proved the exported
`SensorMainActivity` MAIN/LAUNCHER and MAIN/HOME/DEFAULT filters. The Fire APK
also passed packaged permission/component and DEX checks for
`FireModeActivity`, `FireRedirectAccessibilityService`, and
`FireBootReceiver`; the regular APK proved those Fire-only additions absent.

The Fire debug APK was installed on Amazon KFKAWI / Fire OS 7.3.2.9. Because
the previous v1.1.1 APK was signed with an unavailable private release key, the
old APK was preserved and the app was uninstalled before the differently
signed debug build was installed; AGC DSKY local app data was reset. Live
verification proved explicit launch, HOME registration, HOME-key redirect,
full reboot return to `SensorMainActivity`, and HOME-key return after reboot.
Amazon Launcher remained enabled because this firmware protects it from ADB
disable; the native resolver therefore remains Amazon Home and the verified
boot path is the restored same-package Fire redirect.

The full CDP-based AGC/device suite, widget rendering, DreamService UI, and
physical long-PRO behavior were not rerun during this Fire HOME repair.

Hard checkpoint:

```bash
bash tools/build-local.sh
bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk
bash tools/fire-tablet-home-setup.sh app/build/outputs/apk/fire/debug/app-fire-debug.apk
```

## Remaining acceptance gates

- [x] Exact recursive checkout and pinned binary verification pass.
- [x] Canonical local build and APK verifier pass for regular and Fire variants.
- [x] Fire APK installs/launches and returns after reboot on KFKAWI / Fire OS 7.3.2.9.
- [ ] EL home-screen widget appears as EL section only, with no bezel/case/keyboard/annunciator bank/chrome.
- [ ] Widget resize preserves the 106:190 EL aspect without clipping and tap opens the app.
- [ ] Widget refresh/timezone behavior is verified on the target launcher, including Android alarm batching behavior.
- [ ] Real relay/raw-channel-aware Luminary V35 device gate passes.
- [x] Host Comanche V35 produces exact raw relay-12 `00650` as source specifies.
- [ ] Real pinned-WASM `V16N65E` host gate passes for both ropes (representative non-V35 Pinball semantics through channel `015`).
- [ ] Long physical PRO hold produces intended behavior through channel `032`.
- [ ] Real OS screen-off/on preserves a surviving in-memory core.
- [ ] Page/process recreation restores mission/requested mode from a fresh reset.
- [ ] DreamService startup/display-only behavior is verified through Android UI.
- [ ] DREAM DIM / BRIGHT / SOLAR and first-use location permission are verified physically.
- [ ] DISPLAY crop/scaling is visually verified in portrait and landscape.

## Known limitations

1. Full CM peripheral fidelity is not claimed because the pinned WASM exposes no `CmOrLm` setter.
2. Exact CPU/erasable-memory continuation across process death is not implemented.
3. Android/WebView/compositor/permission/DreamService/widget behavior remains the hard runtime verification boundary.
4. The original private signing key is not committed; a differently signed local APK cannot update the old signed app in place.
5. Old reconstructed/repacked APKs are not evidence for this source revision.
6. Inexact minute widget alarms can be delayed/batched by Android; the EL widget is not a guaranteed real-time seconds display.

## Build policy

Builds remain local/manual. Do not add GitHub Actions, Codespaces, or another hosted build service. The canonical local path may use a system Gradle or the repository's checksum-verified Gradle 9.5.1 bootstrap, but still requires the Android SDK/platform/build-tools locally.
