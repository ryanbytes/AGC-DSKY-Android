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

`NetClient` now intercepts:

`https://appassets.androidplatform.net/assets/...`

and serves matching paths directly from Android `AssetManager`. MainActivity and DreamService both load the DSKY page through that origin.

This is a local/offline resource mechanism; the app does not need to fetch the AGC core or rope from the Internet.

### Minimal WASI wrapper

The pinned `yaAGC.wasm` import table was inspected. It imports `env.memory` plus only four WASI Preview 1 functions:

- `fd_close`
- `fd_fdstat_get`
- `fd_seek`
- `fd_write`

`app/src/main/assets/agc-core.js` provides those functions directly and then uses yaAGC exports for rope loading, reset, stepping, packet input/output, and version reporting.

This avoids pulling `@wasmer/wasi` and `@wasmer/wasmfs` into the Android WebView merely to satisfy four imports.

The minimal WASI implementation is source-complete but still requires runtime testing on Android. If an exported yaAGC call traps, inspect the actual trap before expanding the WASI layer.

### AGC clocking

The wrapper follows webAGC's approximate timing model:

- ~11.72 microseconds per AGC instruction.
- JavaScript timer/drain loop at approximately 60 Hz.
- A maximum catch-up threshold prevents a delayed WebView timer from trying to execute an unbounded instruction burst.

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

`?dream=1&clock=1&dim=1`

Dream mode:

- hides app controls;
- remains in phone-clock mode rather than running yaAGC continuously;
- starts in dim mode;
- sets a low native screen brightness;
- drifts the DSKY by a few pixels once per minute.

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

1. Perform the first real recursive-checkout v0.7 Gradle build.
2. Run on Android and verify the synthetic HTTPS asset origin serves WASM and rope files.
3. Verify the minimal WASI shim by actually instantiating and stepping yaAGC.
4. Capture first real channel packets from Luminary099 and compare displayed state against VirtualAGC/webAGC.
5. Verify every physical DSKY key, especially PRO and RSET behavior.
6. Verify channel-010 sign clearing, blank codes, VN flash polarity, and EL-off behavior.
7. Add selectable Comanche055 CM mode only after the first Luminary099 path is stable.
8. Add user-adjustable dream brightness (target 2–25%) through a settings Activity.
9. Do screenshot comparison against close-up genuine DSKY imagery on the actual phone.
