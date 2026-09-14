# DSKY runtime refactor status

Updated: 2026-09-14

This note records the current runtime/input ownership after refactor phases 7-10. It is intentionally narrower and more current than the older phase-by-phase history in `PROGRESS.md`.

## Current parser-ordered runtime

The relevant packaged order is:

```text
app.js
  -> dream-silence.js
  -> dsky-keycodes.js
  -> runtime-transitions.js
  -> dsky-input-runtime.js
  -> clock-behavior.js
  -> ... hardware fidelity layers ...
  -> proceed-electrical.js
  -> ... presentation layers ...
  -> keyboard-electrical-interlock.js
  -> ...
  -> relay-show.js
  -> dream-agc.js
```

CM feature scripts are parser-loaded from `index.html`. `cm-mode.js` no longer injects fallback feature scripts, and Relay Show is also parser-loaded with a static control.

## Ownership boundaries

### `app.js`

Still owns the underlying application state and mechanisms:

- actual Comanche/yaAGC loading and reset;
- the real `enterAgc()` and `enterClock()` implementations;
- AGC core reference and app mode state;
- channel decoding and display backing state;
- snapshot/autosave persistence;
- synthetic phone-clock implementation.

The refactor deliberately wraps these mechanisms instead of duplicating them.

### `runtime-transitions.js`

Owns application transition coordination:

- one shared CLOCK -> AGC Promise;
- replacement of the classic-script/global and `AGCDSKY` AGC entry surfaces;
- validated mode/core access for extracted runtime layers;
- pre-CLOCK cleanup hooks;
- replacement of CLOCK entry surfaces when they are available;
- serialization of a CLOCK request behind an already-running AGC load.

A CLOCK request made during `agc-loading` runs physical-input cleanup immediately but delays the underlying `app.js` CLOCK switch until the owned AGC load settles. This prevents the loader's asynchronous completion from switching the app back to AGC after the user selected CLOCK.

Partial AGC-only test harnesses may omit CLOCK entry functions; mode/core authority and cleanup-hook registration still initialize in that environment.

### `dsky-input-runtime.js`

Owns all extracted electrical input primitives:

- channel `015` normal-key make;
- channel `015` KEYRST/all-released level;
- channel `032` maintained PRO contact.

`keyMake(0)` is invalid. Channel-015 zero is reserved for KEYRST and can only be produced through `keyReset()`.

The input runtime uses `runtime-transitions.js` as its mode/core authority and does not read `appStatus()` or `getCore()` directly.

### `keyboard-electrical-interlock.js`

Owns physical behavior of the 18 normal keycoded switches:

- window-capture event ownership;
- one coded switch per complete all-up series-contact cycle;
- contact timing and mechanical presentation;
- minimum KEYRST dwell for ordinary fast touchscreen taps;
- first-contact CLOCK -> AGC handoff;
- retention of the exact core that accepted a make so KEYRST can release the same electrical target.

It does not call `keyPress()`, `keyRelease()`, or channel-015 `writeIo()` directly.

When CLOCK is selected it registers a pre-CLOCK cleanup hook. Any held channel-015 make is reset before the base CLOCK transition stops the AGC. A first-key handoff still waiting on AGC loading is canceled and cannot later reappear as a ghost keycode when the asynchronous load finishes. Blur/hidden cleanup also cancels a pending, not-yet-made handoff.

### `proceed-electrical.js`

Owns physical pointer/lifecycle state for PRO only. The electrical make/release is delegated to `dsky-input-runtime.js`.

PRO no longer wraps `window.enterClock` itself. It registers a pre-CLOCK cleanup hook with `runtime-transitions.js`, returning the maintained active-low channel-032 contact to its released level before `app.js` stops the AGC.

### `clock-behavior.js`

Owns only the document-level CLOCK keypad fallback/queue. It uses:

- the shared frozen DSKY keycode table;
- `runtimeTransitions.requestAgc()` for promotion;
- `dsky-input-runtime.js` for the resulting channel-015 makes.

The normal CM electrical interlock normally stops physical normal-key events earlier at window capture.

## Current regression gates

The canonical local build gate includes dedicated checks for these boundaries:

- `runtime-authority-smoke.js` — transition/input ownership and forbidden direct primitives;
- `runtime-clock-transition-smoke.js` — direct/API CLOCK semantics, pre-CLOCK cleanup hooks, AGC-load serialization, diagnostics, and partial-harness behavior;
- `dsky-input-runtime-smoke.js` — key make, KEYRST, retained-core release, PRO levels, channel-015 zero rejection;
- `clock-mode-behavior-smoke.js` — CLOCK fallback promotion and shared AGC-entry behavior;
- `keyboard-electrical-interlock-smoke.js` — series-key exclusion, minimum KEYRST dwell, PRO bypass, pre-CLOCK held-key release, first-key handoff;
- `keyboard-clock-cancel-smoke.js` — canceled first-key handoff cannot reappear after AGC loading finishes;
- `proceed-electrical-smoke.js` — maintained PRO behavior and centralized pre-CLOCK release;
- `rset-flightpath-smoke.js` — physical RSET remains Pinball `022` plus KEYRST with no synthetic JavaScript reset;
- `runtime-transition-integration-smoke.js` — multi-layer transition/input integration.

## Remaining major boundary

`app.js` still contains the legacy private `AGC_KEY` literal in addition to the standalone frozen `dsky-keycodes.js` table. `tools/dsky-keycode-consistency-smoke.js` currently locks the two copies together so they cannot drift.

The next major monolith edit should remove that private table and make `app.js` consume the standalone keycode module directly. That requires a safe atomic rewrite of `app.js`; it should not be reconstructed manually from partial connector output.

After the keycode migration, the next likely extraction candidates are app-owned input fallback remnants and additional display/runtime state that can be moved without duplicating the authoritative channel decoder.

## Verification limits for this refactor environment

Focused source/VM checks have been used for the extracted transition/input services. The complete recursive checkout, Android SDK/Gradle build, APK verification, Pixel device smoke, and Fire-device smoke have not been run for these phase branches in this environment.

Do not treat source-level smoke results as a verified APK/device result. The canonical acceptance path remains `bash tools/build-local.sh` from a clean recursive checkout, followed by the appropriate regular-phone and Fire device smokes.
