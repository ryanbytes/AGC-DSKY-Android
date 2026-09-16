# Phase 40 — static thick-glass optics for the EL widget

The Android launcher widget cannot receive high-frame-rate phone attitude updates like the WebView DSKY, so phase 40 deliberately keeps the widget static and battery-cheap while making it read as the same physical EL/cover assembly.

## Geometry

The existing MIT/IL SCD 1006315G sheet-2 geometry remains authoritative:

- active EL face: **2.360 × 4.060 in**;
- hardware frame: **2.620 × 4.420 in**;
- nominal insets: **0.130 in** left/right and **0.180 in** top/bottom.

No affine scaling or cropping was added.

## Material model

- Widget frame uses the app's forced FS 36231 screen approximation `#7C8183`.
- EL field uses the forced FS 36076 approximation `#4E535A`.
- A rear-surface shadow is rendered behind the exact active-face boundary.
- A separate transparent `el_widget_glass` bitmap is layered last in `RemoteViews`, above the Android 12+ live hour/minute/second flippers.
- That front plane adds a faint neutral tint, top/left reflection, bottom/right absorption edge, and a restrained grazing highlight.

The small rear/front offsets are optical rendering calibrations, not claimed measured cover-glass thickness. The separate spec-grounded app glass/parallax work can replace those calibrations when a verified cover stack dimension is available.

## Verification

`tools/widget-glass-smoke.js` locks the 1006315G face/frame geometry, FS595 colors, static/no-sensor policy, and glass-above-flippers layer order.

A signed regular APK was built as **1.1.24 / versionCode 20094** over the 1.1.23 runtime with the same release certificate.
