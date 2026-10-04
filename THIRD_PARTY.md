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

The pinned project supplies the Apollo 11 **Comanche 055** rope. The CM-specific yaAGC WebAssembly binary is rebuilt from the VirtualAGC source revision and patch documented in `vendor/yaAGC-cm/README.md`.

## Apollo AGC flight software

`Comanche055.bin` is historical Apollo 11 Command Module AGC flight software preserved by the Virtual AGC/Apollo source-preservation projects and treated there as public-domain U.S. Government material.

## Original DSKY engineering drawings

Original MIT Instrumentation Laboratory / NASA Apollo drawings preserved by the Virtual AGC project are the primary authority for DSKY dimensions, EL construction, legends, finish, electrical behavior, and production specifications. In particular, SCD `1006315` is the primary specification-control drawing for the digital electroluminescent indicator, with the `2003994-121` DSKY assembly chain used to establish installation context.

Production revisions of `1006315` call out nominal 5300-angstrom (530 nm) EL output. The app and native widget use a restrained display-space approximation of that specification and do not add a neon-style spatial halo.

## DSKY electroluminescent vector outlines

The numeric-segment contours used by the WebView DSKY and native EL-only widget are traced from the drawing-backed `1006315G-exact.step` model in Riley Rainey's `agc-mechanical-cad` repository, commit `2d7dccd5bc4f0263a14ac5a4fd112a15d447010d` (STEP blob `841351a225482cb7926aeb4e97cced8db7ba2258`). The paths are normalized into the display's inch datum and mapped to the physical E/H/M/N/K/F/J electrodes. MIT/IL SCD `1006315G` remains the primary specification; the STEP is secondary geometric evidence, not an original NASA drawing.

- Source project: https://github.com/rrainey/agc-mechanical-cad/tree/2d7dccd5bc4f0263a14ac5a4fd112a15d447010d
- Source model: `agc-block-ii/1006315G-exact.step`
- Copyright (c) 2019 Riley Rainey
- License: Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0): https://creativecommons.org/licenses/by-sa/4.0/

The derived path data is adapted from the STEP model; the original model is not bundled. Earlier revisions used Ben Krasnow's `DSKY_EL_replica` (`graphics/DSKY V2.svg`), but its numeric contours were replaced by the drawing-backed STEP transcription and are no longer used by either current renderer.

## Gorton Condensed annunciator vector outlines

- Project: https://github.com/ehdorrii/dsky-fonts
- Source: `source/Gorton-Condensed.sfd`
- Source blob: `15fdfc7ac3507c79fb6bfdb2102acd14d35b0e76`
- Copyright (c) 2019 Eugene Dorr
- License: SIL Open Font License 1.1.

The ten CM alarm-indicator legends use selected Gorton Condensed glyph outlines converted to static SVG paths. No font file is bundled or loaded at runtime. SCD `1006387D` remains the controlling source for the .156-in character height, .025-.030-in stroke envelope, centering, black fill, and legend arrangement; the reconstructed Gorton source supplies the glyph construction.

## Gorton Normal key vector outlines

- Project: https://github.com/ehdorrii/dsky-fonts
- Sources: `source/Gorton-Normal-120.sfd` and `source/Gorton-Normal-180.sfd`
- Source blobs: `33028992cb971f4045b8c5e9ffac720f8307588c` and `9356a37a8c9aed5a7471a5559a9a9c8ac13c1ad1`
- Generated OTF blobs used only as outline-extraction inputs: `314500f5587b5afe27f52c5069efeb12262909c2` and `1f2b149a9916433bef3cde56e4b8dd16aa1b7241`
- Copyright (c) 2019 Eugene Dorr
- License: SIL Open Font License 1.1.

The nineteen DSKY pushbutton legends use selected Gorton Normal glyph outlines converted to static SVG paths. No font file is bundled or loaded at runtime. SCD `1006353B` / ND `1002122` remain controlling for key marking size and stroke: .250-in characters with .030-in strokes for digits/operators and .125-in characters with .022-in strokes for function legends. The SVG normalization keeps those overall-height/stroke pairs while using the reconstructed Gorton geometry.

## Reference material

Historical Apollo documentation, Virtual AGC data, and CuriousMarc restoration material were used as technical/visual references. CuriousMarc restoration imagery is a useful cross-check for surviving hardware appearance but does not override the original engineering drawings. No CuriousMarc video frames are bundled.

## NOAA World Magnetic Model 2025

The phone star-finder's true-north correction uses NOAA NCEI's WMM2025 spherical-harmonic coefficients and published model/error equations. WMM2025 is valid for 2025.0 through 2030.0; the app declines magnetic-to-true conversion outside that interval. The coefficient data are U.S. Government work and are not subject to copyright restrictions.

- Model, official software/data, and validity: [NOAA NCEI World Magnetic Model](https://www.ncei.noaa.gov/products/world-magnetic-model)
- Official WMM2025 test vectors: distributed with NOAA's WMM2025 software package (`WMM2025_TEST_VALUES.txt`)
- Accuracy limits, compass blackout/caution definitions, and declination uncertainty equation: [NOAA NCEI WMM accuracy, limitations, and error model](https://www.ncei.noaa.gov/products/world-magnetic-model/accuracy-limitations-error-model)
- Apple WebKit documents `webkitCompassHeading` as magnetic north: [DeviceOrientationEvent.webkitCompassHeading](https://developer.apple.com/documentation/webkitjs/deviceorientationevent/1804777-webkitcompassheading)

The JavaScript implementation in `app/src/main/assets/geomagnetic-model.js` is a project implementation of the published model equations, not bundled NOAA executable code. `tools/wmm2025-smoke.js` checks its results against the official vectors. The model does not represent local crustal anomalies or external magnetic fields; see NOAA's stated compass limits before interpreting the star-finder as a precision instrument.

## NASA / U.S. Government non-endorsement

AGC DSKY Android is an independent historical simulator. It is not affiliated with, sponsored by, or endorsed by NASA or the United States Government. NASA names and mission references are used descriptively.
