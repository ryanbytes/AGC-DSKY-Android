# Phase 34 — parallax intensity controls

Phase 34 adds user-adjustable parallax strength without changing AGC, relay, channel, keycode, or native IMU semantics.

## Controls

The application controls panel now receives two presentation-only range controls from `parallax-3d.js`:

- **TILT** — scales the existing DSKY/EL panel rotation from 0% to 200%.
- **DEPTH** — scales layer translation, glass highlight travel, and parallax shadow motion from 0% to 200%.

Both default to **100%**, which is exactly the phase-33 visual calibration. Values are stored only as the isolated presentation preferences `dskyParallaxTiltPct` and `dskyParallaxDepthPct` in `localStorage`, so the same settings work in the browser and Android WebView and survive reloads.

The settings apply to both the normal/full DSKY presentation and the large EL-only screen. Dream and reduced-motion presentations remain flat.

## Verification

`tools/parallax-3d-smoke.js` now checks the control styling and persistence keys and behaviorally verifies that:

- 150% tilt produces 1.5× the baseline rotation;
- 50% depth produces 0.5× the baseline layer translation;
- both values persist;
- the Android native quaternion bridge remains a transparent passthrough;
- FULL DSKY DISPLAY and EL-only mode remain parallax-enabled;
- Dream remains flat.

A local regular APK was also rebuilt from the exact 1.1.17 packaged asset lineage with only `assets/parallax-3d.js` and `assets/controls-layout.css` changed. That build is version 1.1.18 / versionCode 20088 and retains the standalone release signer used by 1.1.17.
