# References

## Apollo / VirtualAGC

- Virtual AGC project: https://github.com/virtualagc/virtualagc
- Virtual AGC site: https://www.ibiblio.org/apollo/
- Virtual AGC developer information / yaAGC I/O protocol: https://www.ibiblio.org/apollo/developer.html
- VirtualAGC `yaDSKY2/LM.ini`: LM annunciator map, channel assignments, key codes.
- VirtualAGC `piPeripheral/humanizeScript.py`: channel `010` relay-word decoding and DSKY channel bit names.
- VirtualAGC `piPeripheral/convertNasspLog.py`: DSKY relay/digit code generation and register/sign relay mapping.
- VirtualAGC `yaAGC/agc_engine.h`: fictitious channel `0163` DSKY modulation masks.
- Apollo 11 Luminary 099 `PINBALL_GAME_BUTTONS_AND_LIGHTS.agc`: original DSKY key codes, channel 15 keyboard behavior, channel 10 relay-word display format, and relay digit codes.
- Apollo 11 source mirror: https://github.com/chrislgarry/Apollo-11
- Apollo-derived DSKY interface drawing: https://commons.wikimedia.org/wiki/File:Apollo_DSKY_interface.svg

### Mappings implemented in v0.7

- COMP ACTY: output channel `011` octal, bit 2.
- UPLINK ACTY: output channel `011` octal, bit 3.
- DSKY numerical/relay output: channel `010` octal.
- Normal DSKY keys: input channel `015` octal.
- PRO/Proceed: input channel `032` octal, bit 14.
- yaAGC modulated DSKY state: fictitious channel `0163` octal.

## webAGC

- Source: https://github.com/michaelfranzl/webAGC
- Pinned by this repository at commit `0575ea7a1231e3948bae7d2c22a6ac146da0c38d`.

webAGC is both a behavioral reference and the source of the browser-oriented `yaAGC.wasm` build plus Apollo 11 rope binaries used by the Android v0.7 source. Its `src/webAGC.js` documents the `cpu_step`, `packet_read`, `packet_write`, fixed-memory loading, channel `011`, and channel `0163` flow used as an embedding reference.

The Android project does not require the online webAGC demo for onboard AGC mode.

## Genuine DSKY visual references

CuriousMarc restoration videos were used to stop treating modern CAD/SVG styling as the visual master and instead compare against genuine hardware:

- `Apollo DSKY - part 1: we have a real (and broken) DSKY!`
- `Genuine NASA Apollo DSKY Full Restoration — part 2`
- `Apollo Guidance Computer Part 28: real DSKY display works again after 50 years`

Channel: https://www.youtube.com/@CuriousMarc

Key observations used in the current face:

- EL segments are flat surface emitters, not LED bars.
- Glow should be restrained and relatively uniform.
- Segment ends/corners are more sculpted than a generic seven-segment font.
- Display labels, register separators, COMP ACTY, and numeric segments visually belong to one EL assembly.
- The physical DSKY has significant recess depth, seams, and non-flat mechanical construction.

No CuriousMarc video frames are copied into this repository.
