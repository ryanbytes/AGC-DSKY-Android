# Implementation notes

## Evolution through v6

### Early builds

The first Android shell demonstrated the basic idea but had several visual/runtime problems seen on the test phone:

- DSKY rendered off-center.
- Android title/action chrome remained visible.
- Faceplate was a modern-looking approximation rather than Apollo hardware.
- Keyboard initially used the wrong arrangement.
- Numeric display fields were compressed because percentage-based layout distorted the individual digits.

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

The segment geometry uses custom paths rather than generic CSS rectangles. The current paths use:

- slim chamfered horizontal elements;
- only a slight lean in vertical elements;
- very low-opacity unlit segment ghosts;
- restrained blur so the display reads as a flat electroluminescent emitter rather than an LED clock;
- a three-element sign cell (horizontal + separate upper/lower vertical elements).

COMP ACTY, labels, separator rules, and all numeric fields occupy the same SVG glass coordinate system.

## Historical network-driven COMP ACTY

The v6 clock shell temporarily repurposed COMP ACTY as an aggregate phone-network activity indicator using `TrafficStats` and an `agcnet://poll` WebView bridge.

That implementation is now **obsolete and removed from v0.7 source**. It must not be reintroduced as AGC behavior.

In AGC mode, COMP ACTY is driven only by authentic Block II output channel `011` octal, bit 2.

## v0.7 onboard AGC architecture

### Pinned core

`vendor/webAGC` is a Git submodule pinned to Michael Franzl's webAGC repository at commit:

`0575ea7a1231e3948bae7d2c22a6ac146da0c38d`

The submodule provides:

- `src/yaAGC.wasm`
- `demo/agc/Luminary099.bin`
- `demo/agc/Comanche055.bin`

Gradle merges the webAGC `src` directory and its `demo/agc` directory into Android assets. A recursive Git checkout is therefore required.

### Synthetic HTTPS asset origin

Modern WebView binary `fetch()` behavior is more predictable on an HTTP(S) origin than on `file:///android_asset/`.

`NetClient` intercepts:

`https://appassets.androidplatform.net/assets/...`

and serves matching paths directly from Android `AssetManager`. MainActivity and DreamService both load the DSKY page through that origin.

This is a local/offline resource mechanism; the app does not need to fetch the AGC core or rope from the Internet. Current `NetClient` resolves the request with URI path segments, rejects traversal/separator tricks, and deliberately avoids substring/index arithmetic on untrusted request paths. This specifically prevents recurrence of the `StringIndexOutOfBoundsException` seen in an old hand-built diagnostic APK.

### Minimal WASI wrapper

The pinned `yaAGC.wasm` import table was inspected. It imports `env.memory` plus only four WASI Preview 1 functions:

- `fd_close`
- `fd_fdstat_get`
- `fd_seek`
- `fd_write`

`app/src/main/assets/agc-core.js` provides those functions directly and then uses yaAGC exports for rope loading, reset, stepping, packet input/output, and version reporting.

This avoids pulling `@wasmer/wasi` and `@wasmer/wasmfs` into the Android WebView merely to satisfy four imports.

The minimal WASI implementation is source-complete but still requires runtime testing on Android. If an exported yaAGC call traps, inspect the actual trap before expanding the WASI layer.

### AGC mission selection

Apollo 11 LM `Luminary099.bin` remains the default rope. The hidden normal-app controls now also allow selecting CM `Comanche055.bin`.

- The mission choice is stored in local storage.
- Switching mission while AGC mode is running stops the current core, loads a new core with the selected rope, and starts from reset.
- Switching mission while in phone-clock mode changes only the selected mission; the selected rope is loaded when AGC mode is next entered.
- DreamService never enters AGC mode and ignores the mission control path.

Mission selection changes the fixed-memory rope only. It does not pretend to model the different spacecraft's complete external environment or peripherals beyond the DSKY interface currently implemented.

### AGC clocking and lifecycle

The wrapper follows webAGC's approximate timing model:

- ~11.72 microseconds per AGC instruction.
- JavaScript timer/drain loop at approximately 60 Hz.
- A maximum catch-up threshold prevents a delayed WebView timer from trying to execute an unbounded instruction burst.

The normal app now explicitly coordinates Activity/WebView visibility with the frontend:

- MainActivity signals hidden before `WebView.onPause()`.
- If the same WebView/JavaScript heap survives, the running yaAGC timer is stopped but the in-memory core is retained.
- On resume, the same core timer is restarted without a CPU reset.
- MainActivity also calls `WebView.saveState()` / `restoreState()` for Activity recreation and the frontend persists selected mission plus requested AGC/CLOCK mode in local storage.
- A recreated page/process does **not** preserve the yaAGC JavaScript heap, CPU registers, or erasable memory. It re-enters the selected AGC mission from a fresh reset. Full AGC snapshot serialization has not been implemented.

This distinction is intentional: ordinary screen-off/screen-on should not unnecessarily kick a surviving AGC session back to phone-clock mode, while process recreation must not falsely claim exact AGC continuation.

### DSKY output decoding

`app.js` handles authentic DSKY peripheral state, leaving the core wrapper UI-independent.

Channel `010` is decoded as the Apollo relay word:

`AAAABCCCCCDDDDD`

where A selects the relay, B is a special/sign relay, and C/D are 5-bit display relay codes.

Implemented relay words cover:

- PROG
- VERB
- NOUN
- all 15 register digits
- plus/minus sign relays for R1/R2/R3
- VEL
- NO ATT
- ALT
- GIMBAL LOCK
- TRACKER
- PROG annunciator

Channel `011` supplies COMP ACTY and UPLINK ACTY.

yaAGC's fictitious/modulated channel `0163` supplies caution/blink state used for TEMP, KEY REL, OPR ERR, RESTART, STBY, VERB/NOUN flashing, and EL-off handling.

### DSKY input

Normal keys are sent on input channel `015` with the original Pinball 5-bit key codes.

PRO is different from every other key: it is a discrete input on channel `032`, bit 14 (`20000` octal), so the wrapper pulses that bit separately.

The yaAGC U-bit peripheral masks are initialized as:

- channel `015`: `00037` octal
- channel `032`: `20000` octal

This prevents the DSKY peripheral model from claiming unrelated spacecraft input bits.

## DreamService

`AgcDreamService` uses the same local HTTPS asset page with:

`?dream=1&clock=1&display=1`

Dream mode:

- is a separate WebView from MainActivity;
- is always the synthetic phone-clock presentation rather than running yaAGC continuously;
- is display-only and non-interactive;
- hides the keypad, app controls, hint, and lower fasteners;
- uses independent persistent `DIM`, `BRIGHT`, and `SOLAR` dream-brightness choices;
- sets Android-window brightness through the `DreamBridge` JavaScript interface;
- drifts the cropped upper DSKY by a few pixels once per minute.

Because DreamService has its own page and `dream=1` forces display-only only for that page, Dream presentation is not intended to latch MainActivity into display-only/clock state. MainActivity's own saved `displayOnly` preference remains independent.

## Controls

The normal app's hidden controls currently include:

- DIM
- DREAM DIM/BRIGHT/SOLAR selector
- TICK ON/OFF
- DISPLAY
- mission selector (`LM L99` / `CM C55`)
- AGC/CLOCK toggle

The control strip has a separate small responsive stylesheet so the added mission selector can wrap on narrow portrait phones instead of running offscreen.

## Signing

A persistent signing key was created for v5/v6 but is not committed. Never put private signing material in the repository.

A build signed with another key cannot update an installed copy signed by that old key.

## Build policy

Per repository-owner instruction:

- do not add or use GitHub Actions for builds;
- build locally/manual;
- clone/update Git submodules before building;
- do not claim build/install/runtime success without observing it.

See `AGENTS.md` and `docs/PROGRESS.md` for current handoff and verification gates.

## Remaining high-value work

1. Perform the first real recursive-checkout v0.7 Gradle build from the current source revision.
2. Run on Android and verify the synthetic HTTPS asset origin serves WASM plus both rope files.
3. Verify the minimal WASI shim by actually instantiating and stepping yaAGC.
4. Capture first real channel packets from Luminary099 and compare displayed state against VirtualAGC/webAGC.
5. Verify every physical DSKY key, especially PRO and RSET behavior.
6. Verify channel-010 sign clearing, blank codes, VN flash polarity, and EL-off behavior.
7. Verify Comanche055 can be selected, loads cleanly, and produces sensible DSKY output.
8. Verify screen-off/screen-on resumes an in-memory AGC core without switching to synthetic clock mode.
9. Verify DreamService activation/deactivation leaves the normal app's mode/display state correct.
10. Add user-adjustable dream brightness (target 2–25%) through a settings Activity if the three current dream modes prove insufficient.
11. Do screenshot comparison against close-up genuine DSKY imagery on the actual phone.
