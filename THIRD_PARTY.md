# Third-party references and software

## Virtual AGC / yaAGC

The Android source now integrates the real yaAGC execution core through a pinned `webAGC` submodule:

- Virtual AGC: https://github.com/virtualagc/virtualagc
- Project documentation: https://www.ibiblio.org/apollo/
- yaAGC/Virtual AGC source is GPL-2.0-or-later.

The app's Gradle asset sources package `yaAGC.wasm` from the pinned submodule into v0.7 builds. This repository's own Android/frontend code remains GPL-2.0 compatible.

## webAGC

Michael Franzl's webAGC project supplies the browser-oriented yaAGC WebAssembly build and Apollo 11 rope binaries used by the Android integration:

- https://github.com/michaelfranzl/webAGC
- Pinned submodule commit: `0575ea7a1231e3948bae7d2c22a6ac146da0c38d`
- Upstream webAGC source is GPL-2.0-or-later.

The Android app does not use webAGC's Wasmer JavaScript runtime. `app/src/main/assets/agc-core.js` provides a small embedding layer for the four WASI calls imported by this yaAGC WASM build and exposes the yaAGC packet/cpu API to the local DSKY frontend.

## Apollo 11 rope images

The pinned webAGC submodule contains the Apollo 11 AGC rope images used here:

- `Luminary099.bin` — Lunar Module Apollo 11 flight software; initial/default AGC mode.
- `Comanche055.bin` — Command Module Apollo 11 flight software; retained for later selectable CM mode.

The original Apollo AGC flight software is treated as public-domain material by the Virtual AGC/Apollo source preservation projects.

## DSKY geometry/reference artwork

Development used Apollo-derived DSKY artwork and VirtualAGC configuration data to correct the keyboard, annunciator, and display geometry. One useful open-source reference is `Apollo_DSKY_interface.svg` in the PyDevices examples, which in turn identifies the Wikimedia/NASA-derived DSKY interface artwork as its source.

VirtualAGC `LM.ini` and Apollo Pinball source were used to verify the Apollo LM annunciator map, relay-word display format, and DSKY key codes.

## CuriousMarc restoration material

CuriousMarc's videos of a genuine restored Apollo DSKY were used as visual reference for the physical display, key depth, electroluminescent appearance, panel construction, and general proportions. No video frames or copyrighted images are bundled in this repository.
