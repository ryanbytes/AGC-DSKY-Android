# Third-party software and references

## Virtual AGC / yaAGC

- Project: https://github.com/virtualagc/virtualagc
- Documentation: https://www.ibiblio.org/apollo/
- License: GNU GPL version 2 or later.

The Android app executes the real `yaAGC` core through WebAssembly. VirtualAGC's DSKY tools are also used to cross-check channel/relay behavior against the preserved Apollo documentation. The K1-K5 character-contact decoder in `dsky-relay-matrix.js` follows the relay contact logic traced in VirtualAGC `Tools/traceDSKY.py` from the original DSKY schematics.

## webAGC

- Project: https://github.com/michaelfranzl/webAGC
- Pinned submodule revision: `0575ea7a1231e3948bae7d2c22a6ac146da0c38d`
- License: GNU GPL version 2 or later for the upstream software.

The pinned project supplies the browser-oriented yaAGC WebAssembly build and the Apollo 11 **Comanche 055** rope used by this CM-only app.

## Apollo AGC flight software

`Comanche055.bin` is historical Apollo 11 Command Module AGC flight software preserved by the Virtual AGC/Apollo source-preservation projects and treated there as public-domain U.S. Government material.

## Original DSKY engineering drawings

Original MIT Instrumentation Laboratory / NASA Apollo drawings preserved by the Virtual AGC project are the primary authority for DSKY dimensions, EL construction, legends, finish, electrical behavior, and production specifications. In particular, SCD `1006315` is the primary specification-control drawing for the digital electroluminescent indicator, with the `2003994-121` DSKY assembly chain used to establish installation context.

Production revisions of `1006315` call out nominal 5300-angstrom (530 nm) EL output. The app and native widget use a restrained display-space approximation of that specification and do not add a neon-style spatial halo.

## DSKY electroluminescent vector outlines

The normalized numeric-segment path outlines currently used by `dsky-geometry.js` and the native EL-only widget are derived from Ben Krasnow's `DSKY_EL_replica` project (`graphics/DSKY V2.svg`). They are retained as a vector transcription source where exact original segment contours have not yet been re-entered directly from the engineering drawing; they are not treated as overriding the original MIT/NASA dimensions or specifications.

- Project: https://github.com/benkrasnow/DSKY_EL_replica
- Copyright (c) 2019 Ben Krasnow
- License: MIT

The copyright and MIT permission notice are retained in the source and packaged `THIRD_PARTY_NOTICES.txt`.

## Reference material

Historical Apollo documentation, Virtual AGC data, and CuriousMarc restoration material were used as technical/visual references. CuriousMarc restoration imagery is a useful cross-check for surviving hardware appearance but does not override the original engineering drawings. No CuriousMarc video frames are bundled.

## NASA / U.S. Government non-endorsement

AGC DSKY Android is an independent historical simulator. It is not affiliated with, sponsored by, or endorsed by NASA or the United States Government. NASA names and mission references are used descriptively.
