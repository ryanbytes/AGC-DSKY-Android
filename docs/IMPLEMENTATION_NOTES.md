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

Required upstream input is:

- `demo/agc/Comanche055.bin`

The Android/Apple/PWA builds use the CM-configured core at `vendor/yaAGC-cm/yaAGC.wasm`; see its README for exact source, patch, toolchain, and rebuild identities.

A recursive checkout is required. The Android build does **not** package the whole upstream `src` or `demo/agc` trees: Gradle stages only the two required verified binaries into generated assets. The source/build/APK gates reject missing, changed, or stale copies and check the exact pinned Git blobs.

### Synthetic HTTPS asset origin

MainActivity and DreamService load:

`https://appassets.androidplatform.net/assets/...`

`NetClient` serves matching paths directly from Android `AssetManager`. It rejects traversal/separator tricks and uses URI path segments rather than substring arithmetic. WebView network loads remain blocked. The manifest's `INTERNET` permission is used by native UDP SNTP and HTTPS GitHub updater requests, never by WebView navigation.

### Minimal WASI wrapper

The CM-configured `yaAGC.wasm` imports exactly `env.memory` plus WASI Preview 1:

- `fd_fdstat_get`
- `fd_seek`
- `fd_write`

`agc-core.js` supplies these locally and uses yaAGC exports for fixed-memory loading, reset, stepping, packet I/O, and optional version reporting.

The canonical host preflight (`tools/wasm-runtime-smoke.js`) instantiates the **actual pinned binary**, loads the Comanche rope, and executes real Pinball input paths before Gradle starts. The gate proves Comanche V16N65, P00, V35, and MARK/KEYRUPT2 consumption. This is host proof against the pinned WASM and rope, not an Android/WebView runtime test.

### Command Module only

The app loads the pinned `Comanche055.bin` rope. The former mission selector and Luminary rope path have been removed; old `agcMission` values are normalized to `comanche055` on startup. The DSKY uses the CM face, including blank ALT/VEL positions. Phone PIPA scaling and sextant/navigation input follow the CM calibration.

### Phone-side real-sky star finder

`apollo-stars.js` keeps all 37 Apollo 11 Comanche star vectors intact as historical AGC data. The phone-side star finder uses their Hipparcos New Reduction (I/311) matches: ICRS positions at J1991.25 plus the catalog's eastward `mu_alpha*cos(dec)` and northward proper motions. It propagates each position on the celestial sphere to the observation epoch, then precesses from the ICRS/J2000-aligned frame into the date's mean equator/equinox before combining it with Greenwich mean sidereal time. The 37 propagated Hipparcos matches recover their source Comanche vectors at epoch 1970.0 within 5 arcseconds. Star altitudes, azimuths, and candidate-pair separations all use these same observation-date positions. The vectors and their flight-facing navigation inputs are unchanged.

The Hipparcos linear proper-motion model is used for distant-epoch extrapolation; its short-baseline acceleration terms are not extrapolated because ESA recommends using the main-catalogue linear parameters at distant epochs. The overlay still uses lightweight IAU 1976 precession and GMST, approximates ICRS as J2000-aligned FK5, and does not model nutation, aberration, annual parallax, atmospheric refraction, or UT1 separately from UTC. It is an approximate star-finding aid, not a precision pointing or navigation source. References and current accuracy checks are in `docs/REFERENCES.md` and `tools/apollo-stars-accuracy-smoke.js`.

DreamService never starts yaAGC. The rebuilt core defaults `CmOrLm` to CM and exposes a configuration/readback API that the wrapper invokes before CPU startup. Comanche is the only supported rope; this DSKY-focused app does not implement unrelated spacecraft peripherals.

### AGC clocking and lifecycle

The wrapper follows webAGC's approximate timing model (~11.72 μs per AGC instruction with a JavaScript scheduling/drain loop). A catch-up cap prevents a delayed WebView timer from running an unbounded burst.

Lifecycle distinction:

- same surviving WebView: AGC timer pauses while hidden and resumes the same in-memory core;
- page/Activity/process recreation: CM rope/requested run mode and a schema-1 snapshot of the full WASM linear memory persist; a fresh yaAGC object imports that memory before execution resumes;
- snapshot restore requires the same mission and yaAGC core version, validates the full memory length/fingerprint before mutating the new core, and resets JavaScript scheduler counters and releases external DSKY inputs.

### DSKY output relay model

Channel `010` is interpreted as:

`WWWWBCCCCCDDDDD`

where W selects a relay row, B is the row discrete/sign bit, and C/D are five-relay character states.

The character relay codes are source-backed, not decimal assumptions. The current code has one selector/sign topology shared by real AGC output decoding and synthetic phone-clock relay generation. Invalid five-bit character patterns are rejected rather than silently treated as blank.

Visible CM mapping covers PROG, VERB, NOUN, all 15 register digits, R1/R2/R3 signs, and the four CM-visible relay-12 condition lamps: NO ATT, GIMBAL LOCK, TRACKER, and PROG. The relay-12 decoder retains the six Apollo-11-era condition bits, including ALT and VEL, but the CM face intentionally does not render the LM-only ALT/VEL lamps. Channel `011` supplies COMP ACTY and UPLINK ACTY. yaAGC synthetic/modulated channel `0163` supplies TEMP, KEY REL, OPR ERR, RESTART, STBY, V/N blanking, and EL-off state.

The relay/click model counts low-11 latch changes, including physically driven fields that have no visible connection. The V35 example is selector 8: ordinary display rendering uses only its D field for R1D1, but Comanche `FULLDSP` still drives the unused C five-relay bank.

### Relay timing

Luminary 99 T4RUPT provides three distinct timing scales used by the synthetic clock hardware model:

- normal display service: 120 ms;
- relay-drive/settle: 20 ms;
- quick dirty-bank sequence: 40 ms start-to-start (20 ms drive + 20 ms off).

Authentic AGC mode does not add that synthetic scheduler; it consumes yaAGC's emitted channel words.

### V35 light-test model

Comanche source defines the current source-backed light-test behavior:

- `FULLDSP = 05675` -> low-11 `01675`
- `FULLDSP1 = 07675` -> low-11 `03675` on plus rows 7/5/2
- `TSTCON2 = 40674` -> relay-12 low-11 `00674`
- `TSTCON1 = 00175`
- TEST ALARM drives RESTART/STBY behavior
- `SHOLTS = 0764`, approximately five seconds

Both physical five-relay character banks carry digit code `035` on every numeric V35 row, including selector 8's visually unused C bank. COMP ACTY is not part of the V35 test mask.

yaAGC's hardware model uses a 1.28-second DSKY flash period with 75% duty cycle; its off quarter blanks V/N and suppresses KEY REL/OPR ERR. Real AGC mode follows channel `0163`. Phone-clock V35 mirrors this modulation locally because no engine is running.

Synthetic V35 now owns its display for the test duration: ordinary keys are ignored except RSET. RSET explicitly calls `cancelLampTest()` before base clock reset, and AGC/mission transitions use the same explicit cancellation barrier so neither the five-second timeout nor 320 ms interval can leak into another mode.

### Modular frontend runtime and diagnostics

The former monolithic `app.js` / `app-refine.js` implementation was replaced with focused runtime modules. `index.html` defines their load order, and `tools/asset-reference-smoke.js` rejects the removed files and locks required assets/order. Make changes in the owning module and update its focused smoke rather than adding another post-load patch layer.

Read-only AGC snapshots are exposed by the current snapshot/runtime modules and are used by device smokes. Raw channel words should remain available alongside decoded fields when they carry hardware state that diagnostics need to show. The current diagnostics page displays raw channel `012` octal in addition to the decoded selector-4 state.

### DSKY input

Normal keys use input channel `015` with original Pinball five-bit codes. PRO is separate: channel `032`, bit 14 (`20000` octal), held for actual pointer duration.

Peripheral U-bit masks are:

- channel `015`: `00037`
- channel `032`: `20000`

The ring-buffer backend initializes lazily, so the wrapper must preserve rope load -> reset -> disposable step -> output discard -> reset -> U-bit mask sequence.

## DreamService

`AgcDreamService` loads the same local page with dream/display query state. It has a separate WebView, remains synthetic clock/display-only, hides controls, supports DIM/BRIGHT/SOLAR, sets window brightness through `DreamBridge`, and applies small periodic position drift. It is intentionally interactive so touch reaches the WebView: a brief display tap toggles relay ticking, while a 1.8-second hold calls `DreamBridge.finishDream()`. `tools/dream-interaction-smoke.js` exercises this packaged-page gesture logic and checks the native interactive/exit bridge source contract.

Dream presentation must not cause MainActivity to inherit display-only/clock state. Same-origin WebStorage is intentionally shared because Activity and DreamService remain in the same app process/origin.

## Build and verification policy

Per owner instruction:

- no hosted APK builds, signing, or tests; the release-only workflow may publish an already built and verified signed payload;
- build and test locally/manual;
- never claim build/install/runtime success without observing it;
- never substitute reconstructed/repacked DEX/APK surgery for the real Gradle application.

`tools/build-local.sh` is the canonical source/build entrypoint. It syntax-checks helper scripts, runs the canonical modular source-smoke suite and real-WASM host semantic gate, builds cleanly, and runs APK verification for both debug variants.

`tools/verify-apk.sh` independently verifies exact upstream binary blobs, APK metadata/permissions/signature, and dynamically discovers every local `src=`/`href=` frontend asset in current `index.html` for byte-for-byte source comparison. It also handles local SVG fragment references while verifying the referenced packaged asset.

The preferred Android checkpoint is:

```bash
bash tools/device-full-smoke.sh app/build/outputs/apk/regular/debug/app-regular-debug.apk
```

Its V35 semantic driver now proves a channel-driven P00 `PROG 00` precondition before V35, exact FULLDSP/FULLDSP1 relay latches, rendered `88` / `+88888`, expected annunciators with COMP excluded, and a real yaAGC-modulated V/N + KEY REL/OPR ERR off phase.

## Remaining high-value work

1. Run the isolated full device gates on a Fire build/Fire OS. The Regular debug build now passes the complete gate on the Android 16 emulator; its package is `.eltest` and its installed state is separate from production.
2. Run the macOS/iOS Apple builds in their target runtimes and verify WebKit asset loading, interaction, relay haptics, and printing. In this audit, the macOS Debug app rebuilt and launched; its WebKit accessibility tree exposed the Apollo DSKY and all key controls. The iOS 26.5 iPhone 17e simulator app rebuilt, installed, and launched with the complete DSKY face and `HOLD PANEL FOR OPTIONS` visible. The captured portrait frame showed the live V16 N65 monitor and three numeric registers with OPR ERR clear. These runs verify startup and rendering; key/touch input was not exercised in either target. Physical Apple runtime, tactile output, and printing remain unverified.
3. Continue representative non-V35 Pinball input coverage. The packaged Android WebView drives `V37E00E` -> `V16N65E` -> `V37E00E` -> `V05N09E` -> `V37E00E` -> `V14N09E` -> `V35E`; V16/V05 use DSKY pointer input and V14 exercises WebView keydown/keyup events sent through DevTools. V05 checks the read-only FAILREG three-word octal response; V14 checks its two-component subset and OPR ERR state. The host real-WASM gate checks all eight V05 selectors and only the six R1/R2 V14 selectors. Android handset physical keyboard behavior and further load/extended-verb paths remain open; the host gate also covers MARK/KEYRUPT2.
4. Verify physical PRO standby hold through channel `032`. The real pinned Comanche055/WASM host gate now checks that PRO starts released, clears channel `032` bit `020000` while held, and restores it on release. A two-second pointer-held PRO press/release also passes in the Android emulator. The explicit native Activity pause path now releases held PRO before stopping the core, covered by a lifecycle regression smoke. Physical handset PRO/STBY and pause/resume remain unverified.
5. Repeat actual OS screen-off/on verification on Fire OS and a physical handset. The Android 16 emulator has now passed a real `Asleep`/`Awake` transition with the packaged WebView reporting `appVisible=false` and `coreRunning=false` while asleep, then resuming the same AGC core object after wake. The emulator's AC stay-awake setting and app `FLAG_KEEP_SCREEN_ON` remained enabled during this test.
6. Verify DreamService startup, touch delivery through Android DreamManager, brightness modes, SOLAR permission behavior, and normal-app state after Dream exit. The source gesture contract now has a host regression; the Android 16 emulator lacks a DreamManager service, and Fire/physical behavior is unverified.
7. Perform physical portrait/landscape DISPLAY and pixel-level DSKY visual review; the new AUX-menu fit is verified in Chromium and the packaged Android WebView, not on the owner's handset.
8. Verify the PWA on a physical phone browser. A fresh Playwright WebKit profile against the current GitHub Pages deployment installed the post-removal worker, cached 89 assets including yaAGC/Comanche, reloaded offline, and entered real Comanche P00 then V16N65 with three numeric registers and OPR ERR clear. No analytics script was present. The site cache identifier is `agc-dsky-pwa-2cf538cb60e1`; PR #263 changed Android updater Java and audit docs/tests only, not the PWA payload. Physical phone-browser behavior remains unverified.
9. Repository and deployed-client analytics code were removed and the current public Pages client no longer serves the analytics asset. This does not establish whether a manually deployed Cloudflare Worker, D1 database, or previously collected records still exist; those external resources and any deletion remain unverified.
10. GitHub's latest published Android release remains v1.1.64; `main` carries candidate metadata v1.1.65 / versionCode 2026100303. The broader code and physical-accuracy audit remains open; no later release is currently published.
