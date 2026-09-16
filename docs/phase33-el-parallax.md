# Runtime refactor phase 33 — EL-only parallax

Date: 2026-09-15

Phase 33 extends the repaired phase-32 motion-parallax controller to the large EL-only (`screen-only`) presentation.

Changes:

- `parallax-3d.js` no longer disables presentation solely because `screen-only` is active. Dream mode and `prefers-reduced-motion` remain flat.
- `parallax-3d.css` keeps the full-screen DSKY viewport shell fixed at its existing `translate(-50%,-50%)` geometry and applies tilt/depth only to the large EL SVG.
- The EL-only glass sheen follows the same native quaternion-driven light/parallax variables with a slightly deeper translation layer.
- FULL DSKY DISPLAY and normal DSKY parallax behavior are unchanged.
- `tools/parallax-3d-smoke.js` now requires EL-only mode to remain parallax-enabled while Dream mode disables the effect.

Verification performed in the local build environment:

- `node --check app/src/main/assets/parallax-3d.js` passed.
- `node tools/parallax-3d-smoke.js` passed. The 8-degree native quaternion probe retained the phase-32 response (`targetX` about 0.587, layer translation about 2.464, Y tilt about 1.056 degrees).
- A regular standalone APK was rebuilt from source/resources using Android platform 37 and Build Tools 36.0.0.
- APK package: `org.apollo.agcdsky`, version `1.1.17`, versionCode `20087`.
- APK signature verification passed for v1/v2/v3 and the signer certificate matches the 1.1.16 standalone test build.

Physical-device visual acceptance remains the final gate for the EL-only perspective strength and edge reveal behavior.
