# Phase 39 — forced FS595 hardware palette

The optional hardware-color switch is retired. The DSKY now always uses the FS595-inspired presentation introduced previously:

- main hardware body: screen approximation of FS 36231;
- EL background: screen approximation of FS 36076;
- existing illuminated legends, EL numerals, parallax, and glass-thickness model are unchanged.

`phase37-presentation.js` now adds `authentic-colors` unconditionally and removes the legacy `dskyHardwareColorMode` preference so an older DEFAULT selection cannot survive an upgrade. It no longer creates a color button or exposes setters/toggles; the presentation controller reports `authentic() === true`.

The standalone 1.1.23 / versionCode 20093 APK was rebuilt over the 1.1.22 packaged runtime. Relative to 1.1.22, the presentation asset change is limited to the hardware-color mode controller; the FS595/glass CSS is unchanged. The Android manifest/build metadata changes only for the new version, and the release certificate remains the same update lineage.
