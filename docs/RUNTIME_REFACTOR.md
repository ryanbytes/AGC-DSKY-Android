# DSKY runtime refactor status

Updated: 2026-09-14

This note records the current runtime/input ownership after refactor phases 7-11. It is intentionally narrower and more current than the older phase-by-phase history in `PROGRESS.md`.

## Current parser-ordered runtime

The relevant packaged order is:

```text
dsky-keycodes.js
  -> app.js
  -> dream-silence.js
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

`dsky-keycodes.js` is now parser-loaded before `app.js` and is the single frozen literal source for the 18 normal Block II DSKY/Pinball keycodes. `app.js`, the CLOCK fallback, and the physical electrical interlock all consume that same object. PRO remains intentionally absent from the table because it is a separate maintained channel-032 input.

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

`app.js` no longer owns a private Pinball keycode literal. It requires `window.AGCDSKY_KEY_CODES` from the parser-loaded shared module and fails immediately if that dependency is missing.

The refactor deliberately wraps the remaining app mechanisms instead of duplicating them.

### `runtime-transitions.js`

Owns application transition coordination:

- one shared CLOCK -> AGC Promise;
- replacement of the classic-script/global and `AGCDSKY` AGC entry surfaces;
- validated mode/core access for extracted runtime layers;
- pre-CLOCK cleanup hooks;
- replacement of CLOCK entry surfaces when they are available;
- explicit pending-CLOCK intent through `clockRequested()`;
- serialization of a CLOCK request behind an already-running AGC load.

A CLOCK request made during `agc-loading` marks CLOCK intent first, runs physical-input cleanup immediately, and delays only the underlying `app.js` CLOCK switch until the owned AGC load settles. This prevents the loader's asynchronous completion from switching the app back to AGC after the user selected CLOCK.

While that deferred CLOCK request exists, new input handoffs are not allowed to join the AGC load. Repeated CLOCK requests join the already-pending CLOCK transition instead of rerunning cleanup or creating another transition.

Partial AGC-only test harnesses may omit CLOCK entry functions; mode/core authority, pending-CLOCK state, and cleanup-hook registration still initialize in that environment.

### `dsky-input-runtime.js`

Owns all extracted electrical input primitives:

- channel `015` normal-key make;
- channel `015` KEYRST/all-released level;
- channel `032` maintained PRO contact.

`keyMake(0)` is invalid. Channel-015 zero is reserved for KEYRST and can only be produced through `keyReset()`.

The input runtime uses `runtime-transitions.js` as its mode/core authority and does not read `appStatus()` or `getCore()` directly. It remains capable of releasing an already-active contact during pre-CLOCK cleanup; pending-CLOCK suppression is enforced by the physical/fallback input owners so cleanup itself is never blocked.

### `keyboard-electrical-interlock.js`

Owns physical behavior of the 18 normal keycoded switches:

- window-capture event ownership;
- one coded switch per complete all-up series-contact cycle;
- contact timing and mechanical presentation;
- minimum KEYRST dwell for ordinary fast touchscreen taps;
- first-contact CLOCK -> AGC handoff;
- retention of the exact core that accepted a make so KEYRST can release the same electrical target.

It consumes `window.AGCDSKY_KEY_CODES` and does not contain its own Pinball mapping. It does not call `keyPress()`, `keyRelease()`, or channel-015 `writeIo()` directly.

When CLOCK is selected it registers a pre-CLOCK cleanup hook. Any held channel-015 make is reset before the base CLOCK transition stops the AGC. A first-key handoff still waiting on AGC loading is canceled and cannot later reappear as a ghost keycode when the asynchronous load finishes. Blur/hidden cleanup also cancels a pending, not-yet-made handoff.

While `runtimeTransitions.clockRequested()` is true, new normal-key pointerdowns are consumed at window capture but do not create mechanical/electrical ownership or another channel-015 cycle.

### `proceed-electrical.js`

Owns physical pointer/lifecycle state for PRO only. The electrical make/release is delegated to `dsky-input-runtime.js`.

PRO no longer wraps `window.enterClock` itself. It registers a pre-CLOCK cleanup hook with `runtime-transitions.js`, returning the maintained active-low channel-032 contact to its released level before `app.js` stops the AGC. New PRO makes are suppressed after CLOCK intent has been registered.

### `clock-behavior.js`

Owns only the document-level CLOCK keypad fallback/queue. It uses:

- the shared frozen DSKY keycode table;
- `runtimeTransitions.requestAgc()` for promotion;
- `dsky-input-runtime.js` for the resulting channel-015 makes.

The normal CM electrical interlock normally stops physical normal-key events earlier at window capture.

The fallback queue also registers a pre-CLOCK cleanup hook. CLOCK intent clears queued contacts and advances a promotion epoch so an older asynchronous drain cannot emit a stale keycode or erase a later fresh queue. New fallback contacts during pending CLOCK are consumed but not queued, and expected cancellation does not generate an error report or autosave.

## Current regression gates

The canonical local build gate includes dedicated checks for these boundaries:

- `dsky-keycode-consistency-smoke.js` — the shared frozen Pinball table is canonical, loads before `app.js`, and no consumer regains a duplicate literal;
- `asset-reference-smoke.js` — parser order and required packaged assets;
- `runtime-authority-smoke.js` — transition/input ownership, pending-CLOCK contract, and forbidden direct primitives;
- `runtime-clock-transition-smoke.js` — direct/API CLOCK semantics, pre-CLOCK cleanup hooks, AGC-load serialization, diagnostics, and partial-harness behavior;
- `dsky-input-runtime-smoke.js` — key make, KEYRST, retained-core release, PRO levels, channel-015 zero rejection;
- `clock-mode-behavior-smoke.js` — CLOCK fallback promotion and shared AGC-entry behavior;
- `clock-fallback-cancel-smoke.js` — queued fallback contacts and later fallback contacts cannot survive pending CLOCK intent;
- `keyboard-electrical-interlock-smoke.js` — series-key exclusion, minimum KEYRST dwell, PRO bypass, pre-CLOCK held-key release, pending-CLOCK suppression, first-key handoff;
- `keyboard-clock-cancel-smoke.js` — canceled first-key handoff cannot reappear after AGC loading finishes and later contacts are suppressed;
- `proceed-electrical-smoke.js` — maintained PRO behavior, centralized pre-CLOCK release, and pending-CLOCK make suppression;
- `rset-flightpath-smoke.js` — physical RSET remains shared Pinball `022` plus KEYRST with no synthetic JavaScript reset;
- `runtime-transition-integration-smoke.js` — multi-layer transition/input integration and parser-order contract.

## Remaining major boundaries

The duplicate keycode seam is closed. The next useful `app.js` extractions are the remaining synthetic/legacy input fallback behavior and additional runtime/display state that can be moved without duplicating the authoritative channel decoder.

The channel decoder, snapshot model, actual AGC loader, and display backing state should remain app-owned until an extraction can preserve one authoritative state path rather than adding adapters that mirror mutable state.

## Verification limits for this refactor environment

Focused source/connector checks have been used for the extracted transition/input services and Phase 11 keycode migration. The Phase 11 repository diff confirms the atomic `app.js` replacement changed only the private keycode block: two added lines and four removed lines.

The complete recursive checkout, Android SDK/Gradle build, APK verification, Pixel device smoke, and Fire-device smoke have not been run for these phase branches in this environment.

Do not treat source-level checks as a verified APK/device result. The canonical acceptance path remains `bash tools/build-local.sh` from a clean recursive checkout, followed by the appropriate regular-phone and Fire device smokes.
