# Phase 37 — authentic color option, EL glass, stronger isolated-display parallax

Phase 37 is presentation-only. AGC, channel, keycode, relay, snapshot, and native IMU semantics are unchanged.

## Color switch

A persistent application-control button switches between the existing default palette and an optional FS-595-inspired palette. The default remains unchanged. The authentic option uses screen approximations of:

- DSKY body / surrounding control-panel gray: FS 36231, represented as `#7C8183`.
- EL display background gray: FS 36076, represented as `#4E535A`.

The preference is stored as `dskyHardwareColorMode` and therefore works in both the Android WebView and browser build.

## EL cover glass

The EL presentation now models a finite cover plate instead of only a flat highlight. CSS adds a front-surface reflection, a slightly displaced rear-surface ghost, darker perimeter absorption, and subtle edge/internal reflections. Those effects move with parallax rather than looping autonomously.

## Large EL-only view

The isolated EL display keeps the user tilt/depth sliders but applies an additional calibrated gain over the complete DSKY: 1.55x rotation and 1.70x depth translation. The full DSKY retains its previous phase-36 response. Dream and reduced-motion behavior remain flat.

## Build verification

The local regular build is version 1.1.21 / versionCode 20091. It was rebuilt from the exact 1.1.20 packaged runtime lineage, signed with the same standalone release certificate, passed APK signature and zipalign verification, and differs from 1.1.20 only in five presentation assets: `index.html`, `parallax-3d.js`, `parallax-3d.css`, `hardware-color-mode.js`, and `hardware-color-mode.css`.

The repository branch uses an equivalent late presentation adapter (`phase37-presentation.js` / `.css`) to keep the refactor branch internally consistent with its older asset graph.
