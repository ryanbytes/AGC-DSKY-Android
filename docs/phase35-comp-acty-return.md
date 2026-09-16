# Phase 35 — COMP ACTY return from EL-only view

Phase 35 makes **COMP ACTY** the direct return target from the isolated large EL display.

Behavior:

- a short COMP ACTY tap while `screen-only` is active returns immediately to the full DSKY;
- that return does not open the application controls;
- that return does not toggle relay-click sound;
- the synthetic click following the pointer release is consumed so the EL parent shortcut cannot immediately re-enter `screen-only`;
- a later independent EL tap from the full DSKY still enters the isolated EL presentation;
- ordinary short taps elsewhere in the isolated EL presentation retain the relay-click toggle;
- Dream behavior is unchanged.

`tools/screen-only-comp-return-smoke.js` behaviorally covers those boundaries and is included in `tools/build-local.sh`.

The standalone test APK is version **1.1.19** / versionCode **20089**. It was rebuilt from the exact 1.1.18 packaged/runtime lineage with only `assets/screen-only.js` changed, then aligned and signed with the same standalone release certificate as 1.1.18. The packaged interaction smoke passed and asset comparison confirmed `screen-only.js` was the only changed web asset.
