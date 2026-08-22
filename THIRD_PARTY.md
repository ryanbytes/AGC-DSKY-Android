# Third-party references and software

## Virtual AGC / yaAGC

The project is intended to integrate the real yaAGC execution core in a future offline-emulator mode.

- Virtual AGC: https://github.com/virtualagc/virtualagc
- Project documentation: https://www.ibiblio.org/apollo/
- yaAGC/Virtual AGC source is GPL-2.0-or-later.

No yaAGC binary is bundled in the current v6 APK.

## webAGC

The current `WEB AGC` button points to Michael Franzl's webAGC demonstration:

- https://github.com/michaelfranzl/webAGC
- https://michaelfranzl.github.io/webAGC/demo/

webAGC is used as a reference for real AGC/DSKY behavior. v6 does not package its WASM binary.

## DSKY geometry/reference artwork

Development used Apollo-derived DSKY artwork and VirtualAGC configuration data to correct the keyboard, annunciator, and display geometry. One useful open-source reference is `Apollo_DSKY_interface.svg` in the PyDevices examples, which in turn identifies the Wikimedia/NASA-derived DSKY interface artwork as its source.

VirtualAGC `LM.ini` was used to verify the Apollo LM two-column/seven-row annunciator map and DSKY key codes.

## CuriousMarc restoration material

CuriousMarc's videos of a genuine restored Apollo DSKY were used as visual reference for the physical display, key depth, electroluminescent appearance, panel construction, and general proportions. No video frames or copyrighted images are bundled in this repository.
