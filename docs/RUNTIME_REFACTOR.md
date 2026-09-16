# DSKY runtime refactor status

Updated: 2026-09-14

This note records the current runtime/input ownership after refactor phases 7-14. It is intentionally narrower and more current than the older phase-by-phase history in `PROGRESS.md`.

## Current parser-ordered runtime

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

`dsky-keycodes.js` is the single frozen literal source for the 18 normal Block II DSKY/Pinball keycodes. The only normal-key consumers are `clock-behavior.js` and `keyboard-electrical-interlock.js`. PRO remains separate on channel 032.

## Ownership boundaries

### `app.js`

Still owns the underlying application state and mechanisms:

- actual Comanche/yaAGC loading and reset;
- the real `enterAgc()` and `enterClock()` implementations;
- AGC core reference and app mode state;
- channel decoding and display backing state;
- snapshot/autosave persistence;
- synthetic phone-clock display/relay presentation.

It no longer owns any DSKY input path. Specifically, `app.js` now has:

- no Pinball keycode table/reference;
- no `keyPress()`, `keyRelease()`, `proceedKey()`, or channel-015/channel-032 electrical access;
- no `[data-key]` target-level pointer listener;
- no legacy `press(k)` helper;
- no synthetic CLOCK DSKY command editor or `executeClock()` path.

The old phone-clock `V35 · REAL AGC MODE REQUIRED` command gate disappeared with that editor. Real AGC/Comanche V35 behavior remains authoritative through the hardware/relay model.

### `runtime-transitions.js`

Owns application transition coordination:

- one shared CLOCK -> AGC Promise;
- replacement of the classic-script/global and `AGCDSKY` AGC entry surfaces;
- validated mode/core access for extracted runtime layers;
- pre-CLOCK cleanup hooks;
- replacement of CLOCK entry surfaces when available;
- explicit pending-CLOCK intent through `clockRequested()`;
- serialization of a CLOCK request behind an already-running AGC load.

A CLOCK request made during `agc-loading` marks CLOCK intent first, runs physical-input cleanup immediately, and delays only the underlying `app.js` CLOCK switch until the owned AGC load settles. New input cannot join that load once CLOCK intent is set.

### `dsky-input-runtime.js`

Owns the extracted electrical primitives:

- channel `015` normal-key make;
- channel `015` KEYRST/all-released level;
- channel `032` maintained PRO contact.

`keyMake(0)` is invalid; zero is reserved for KEYRST through `keyReset()`.

### `keyboard-electrical-interlock.js`

Owns physical behavior for the 18 normal keycoded switches:

- window-capture event ownership;
- one coded switch per complete all-up series-contact cycle;
- contact timing/mechanical presentation;
- minimum KEYRST dwell;
- first-contact CLOCK -> AGC handoff;
- retained-core KEYRST;
- pre-CLOCK cleanup and pending-CLOCK suppression.

It delegates make/KEYRST to `dsky-input-runtime.js`. Phase 14 removed its final `window.press`/legacy-app fallback, so unknown runtime states no longer fall into a synthetic editor path.

### `proceed-electrical.js`

Owns physical pointer/lifecycle state for PRO only. Electrical make/release is delegated to `dsky-input-runtime.js`. PRO releases through the shared pre-CLOCK hook and suppresses new makes once CLOCK intent exists.

### `clock-behavior.js`

Owns the document-level CLOCK keypad fallback/queue. It consumes the shared keycode table, uses `runtimeTransitions.requestAgc()` for promotion, and delegates channel-015 makes to `dsky-input-runtime.js`.

Its queue is canceled on CLOCK intent so stale fallback contacts cannot reappear after asynchronous AGC loading.

## Current regression gates

The canonical local source gate includes checks for these boundaries:

- `app-input-boundary-smoke.js` — app cannot regain DSKY electrical ownership, a DSKY target handler, `press()`, or the synthetic command editor;
- `dsky-keycode-consistency-smoke.js` — one frozen Pinball map, consumed only by extracted normal-key owners;
- `asset-reference-smoke.js` — parser order, required assets, and absence of the removed app input/editor surface;
- `runtime-authority-smoke.js` — transition/input ownership and forbidden direct primitives;
- `runtime-clock-transition-smoke.js` — CLOCK semantics, cleanup hooks, AGC-load serialization and diagnostics;
- `dsky-input-runtime-smoke.js` — make, KEYRST, retained-core release, PRO and keycode validation;
- `clock-mode-behavior-smoke.js` and `clock-fallback-cancel-smoke.js` — CLOCK fallback promotion/cancellation;
- `keyboard-electrical-interlock-smoke.js` and `keyboard-clock-cancel-smoke.js` — physical keyboard series-chain, KEYRST and transition behavior;
- `proceed-electrical-smoke.js` — maintained PRO behavior and pre-CLOCK release;
- `rset-flightpath-smoke.js` — RSET remains Pinball `022` plus KEYRST;
- `runtime-transition-integration-smoke.js` — multi-layer transition/input integration;
- `v35-model-smoke.js` — real Comanche V35 relay/hardware model remains intact and the synthetic phone-command path stays absent.

## Remaining major boundaries

The frontend input refactor is now substantially separated from `app.js`. The next useful seams are display/runtime state rather than DSKY input:

- clock relay/display presentation helpers;
- AGC display decoder/render state;
- snapshot UI-state serialization helpers.

The actual AGC loader, channel decoder and snapshot authority should only be extracted when one authoritative mutable-state path can be preserved. Avoid adapters that duplicate or mirror those structures.

## Verification limits

Connector/diff checks verified that the production edits remained narrow through phases 11-14. The complete recursive checkout, canonical `tools/build-local.sh`, Android SDK/Gradle build, APK verification, Pixel device smoke, and Fire-device smoke have **not** been run for these phase branches in this environment.

Do not treat source-level checks as a verified APK/device result. Canonical acceptance remains `bash tools/build-local.sh` from a clean recursive checkout, followed by the regular-phone and Fire device smokes.
