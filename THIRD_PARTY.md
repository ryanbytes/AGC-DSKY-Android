# Third-party software and references

## Virtual AGC / yaAGC

- Project: https://github.com/virtualagc/virtualagc
- Documentation: https://www.ibiblio.org/apollo/
- License: GNU GPL version 2 or later.

The Android app executes the real `yaAGC` core through WebAssembly.

## webAGC

- Project: https://github.com/michaelfranzl/webAGC
- Pinned submodule revision: `0575ea7a1231e3948bae7d2c22a6ac146da0c38d`
- License: GNU GPL version 2 or later for the upstream software.

The pinned project supplies the browser-oriented yaAGC WebAssembly build and the Apollo 11 **Comanche 055** rope used by this CM-only app.

## Apollo AGC flight software

`Comanche055.bin` is historical Apollo 11 Command Module AGC flight software preserved by the Virtual AGC/Apollo source-preservation projects and treated there as public-domain U.S. Government material.

## DSKY electroluminescent geometry

The normalized EL segment outlines used by `dsky-geometry.js` and the native EL-only widget are derived from Ben Krasnow's `DSKY_EL_replica` project (`graphics/DSKY V2.svg`).

- Project: https://github.com/benkrasnow/DSKY_EL_replica
- Copyright (c) 2019 Ben Krasnow
- License: MIT

The copyright and MIT permission notice are retained in the source and packaged `THIRD_PARTY_NOTICES.txt`.

## Reference material

Historical Apollo documentation, Virtual AGC data, and CuriousMarc restoration material were used as technical/visual references. No CuriousMarc video frames are bundled.

## NASA / U.S. Government non-endorsement

AGC DSKY Android is an independent historical simulator. It is not affiliated with, sponsored by, or endorsed by NASA or the United States Government. NASA names and mission references are used descriptively.
