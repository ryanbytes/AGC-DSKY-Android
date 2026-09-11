# AGC DSKY Android progress

Last updated: 2026-09-11

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

## Current host verification and build blocker

The 2026-09-11 correction pass was exercised as far as the current container permits. Observed host results:

- changed relay JavaScript syntax checks passed;
- schematic K1-K5 validation produced **28 distinct physical EL segment patterns** across the 32 relay codes and reproduced every normal blank/0-9 code;
- the CM annunciator order and four blank positions were checked;
- the widget-frame generator produced all **60** register frames using the production `#79EF4F` EL color;
- the exact pinned `yaAGC.wasm` + `Comanche055.bin` executed under Node: `V16N65E` produced numeric output, `V37E00E` reached PROG `00` / relay-11 low-11 `01265`, and real `V35E` reached Comanche relay-12 low-11 `00650`.

These are host/source checks, not an Android build or device test.

The canonical Android build was then attempted/preflighted in the current execution environment. The blockers are concrete:

- Java 21 and Node 22 are available;
- no Gradle installation is available;
- `ANDROID_SDK_ROOT` / `ANDROID_HOME` are absent;
- Android Build Tools 36.0.0 (`aapt2`, `apksigner`) and platform 37 are absent;
- there is no complete current recursive checkout in the build container;
- shell network/DNS cannot resolve GitHub, so the Gradle bootstrap, repository clone/submodule initialization, and Android SDK package download cannot be completed here.

Shortest next experiment: run `bash tools/build-local.sh` on a machine/container with the required Android SDK and exact recursive checkout. The repository still contains an older hosted workflow, but project policy explicitly forbids using GitHub-hosted builds unless the owner separately authorizes that exception; it is therefore not being treated as the build path for this revision.

## Verification status

Historical v1.1.2 regular/Fire source checkpoints have previously completed the canonical local build and Fire-device HOME verification. Those results do **not** automatically apply to the 2026-09-11 drawing/relay revision.

For the current drawing/relay revision:

- [x] source changes are committed to `main`;
- [x] K1-K5 contact matrix is source-gated by `tools/dsky-mapping-smoke.js`;
- [x] individual low-11 relay-change accounting is source-gated;
- [x] WebView/native/generated-widget production EL color agreement is source-gated;
- [x] current host/source and real-Comanche WASM checks above passed;
- [ ] canonical `tools/build-local.sh` has been run successfully for this exact revision;
- [ ] current regular APK has been installed/device-smoked;
- [ ] current Fire APK has been installed/device-smoked;
- [ ] current native EL widget has been visually checked on-device;
- [ ] current physical-screen DSKY geometry has been visually accepted by the owner.

Do not upgrade any unchecked item to verified without actual output from that exact source revision.

## Remaining high-value fidelity work

1. Continue transcribing absolute EL/key geometry from original MIT/NASA drawings where current values still depend on replica vector artwork.
2. Keep CM and LM annunciator configurations distinct; this branch is CM/Comanche-only.
3. Audit the remaining non-latching auxiliary-relay acoustic model against the available indicator-driver schematics; do not invent per-relay measured timings that the surviving documentation does not provide.
4. Run the canonical local build and current-source device gates as soon as the required Android toolchain and recursive checkout are available.

## Build policy

Builds remain local/manual. Do not add or use GitHub Actions, Codespaces, or another hosted build service for this project unless the owner explicitly changes that policy. Never substitute APK surgery/repacking for a real Gradle build.
