# Phase 38 — EL cover-glass thickness parallax

Phase 38 changes the large EL-only presentation so parallax reads as physical cover-glass thickness rather than a reflection painted over the display.

The large EL view now has three presentation planes:

- the EL phosphor/display face is deepest and uses a 0.30 motion gain;
- a rear glass surface uses a 0.68 motion gain;
- the front glass surface uses a 1.24 motion gain and the greatest virtual Z offset.

The front-to-substrate differential is therefore 0.94 of the already-amplified EL parallax value, producing several pixels of relative displacement at stronger phone tilt. The reflection treatment is intentionally faint and localized; the previous broad top reflection band is removed.

The existing phase37 color switch remains unchanged. Both DEFAULT and FS595 modes use the same glass-thickness model. Dream/reduced-motion presentation remains flat.

A sideload build was produced as version 1.1.22 / versionCode 20092 from the exact 1.1.21 packaged runtime lineage, changing only the manifest/version code, compiled BuildConfig, and the two glass presentation assets required for the new depth model. The release signer is unchanged.
